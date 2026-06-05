"use client";

import { useState, useRef, useCallback, useEffect } from "react";
// Mp3Encoder loaded dynamically in convertToMp3() to reduce initial bundle

export type RecorderStatus = "idle" | "recording" | "recorded";
export type AudioFormat = "mp3" | "wav";

interface UseAudioRecorderReturn {
  status: RecorderStatus;
  duration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  discardRecording: () => void;
  getAudioFile: () => File | null;
  recordWaveformRef: React.RefObject<HTMLDivElement | null>;
}

const MAX_DURATION_SECONDS = 300; // 5 minutes

function formatFloat32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

async function convertToMp3(blob: Blob): Promise<Blob> {
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const sampleRate = audioBuffer.sampleRate;
    // Force mono encoding for lamejs compatibility
    const encoder = new Mp3Encoder(1, sampleRate, 128);
    const left = formatFloat32ToInt16(audioBuffer.getChannelData(0));

    const mp3Chunks: BlobPart[] = [];
    const chunkSize = 1152;

    for (let i = 0; i < left.length; i += chunkSize) {
      const leftChunk = left.subarray(i, i + chunkSize);
      const encoded = encoder.encodeBuffer(leftChunk);
      if (encoded.length > 0) mp3Chunks.push(new Uint8Array(encoded) as BlobPart);
    }

    const final = encoder.flush();
    if (final.length > 0) mp3Chunks.push(new Uint8Array(final) as BlobPart);

    return new Blob(mp3Chunks, { type: "audio/mpeg" });
  } finally {
    if (audioContext.state !== "closed") await audioContext.close();
  }
}

// Encodes a decoded AudioBuffer (mono, channel 0) to a 16-bit PCM WAV blob.
// Instagram accepts wav but not mp3, so we use this for non-WhatsApp channels.
function encodeWav(audioBuffer: AudioBuffer): Blob {
  const sampleRate = audioBuffer.sampleRate;
  const samples = formatFloat32ToInt16(audioBuffer.getChannelData(0));
  const dataLength = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate (mono, 2 bytes/sample)
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(offset, samples[i], true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

async function convertToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return encodeWav(audioBuffer);
  } finally {
    if (audioContext.state !== "closed") await audioContext.close();
  }
}

export function useAudioRecorder(options?: { format?: AudioFormat }): UseAudioRecorderReturn {
  const format: AudioFormat = options?.format ?? "mp3";
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Refs so the record-end handler (set up once) reads the latest target format,
  // and getAudioFile knows which format was actually produced.
  const formatRef = useRef<AudioFormat>(format);
  const recordedFormatRef = useRef<AudioFormat>("mp3");
  useEffect(() => {
    formatRef.current = format;
  }, [format]);

  const recordWaveformRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<unknown>(null);
  const recordPluginRef = useRef<unknown>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const audioUrlRef = useRef<string | null>(null);
  const statusRef = useRef<RecorderStatus>("idle");

  // Sync refs with state
  useEffect(() => {
    audioUrlRef.current = audioUrl;
  }, [audioUrl]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const destroyResources = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    // Stop mic stream first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // Stop mic BEFORE ws.destroy() to prevent double AudioContext.close()
    // RecordPlugin.destroy() calls super.destroy() (fires once listener → close)
    // then stopMic() (calls onDestroy → close again). Pre-calling stopMic() avoids this.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record = recordPluginRef.current as any;
    if (record) {
      try { record.stopMic(); } catch { /* ignore */ }
    }
    recordPluginRef.current = null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ws = wavesurferRef.current as any;
    if (ws) {
      try { ws.destroy(); } catch { /* ignore */ }
      wavesurferRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      destroyResources();
    };
  }, [destroyResources]);

  const startRecording = useCallback(async () => {
    // Guard against double calls
    if (statusRef.current !== "idle") return;

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("El navegador no soporta grabación de audio");
    }

    // Destroy any existing instance first
    destroyResources();

    // Dynamic import to avoid SSR issues
    const WaveSurfer = (await import("wavesurfer.js")).default;
    const RecordPlugin = (await import("wavesurfer.js/dist/plugins/record.esm.js")).default;

    if (!mountedRef.current) return;

    const container = recordWaveformRef.current;
    if (!container) return;

    const record = RecordPlugin.create({
      scrollingWaveform: true,
      renderRecordedAudio: false,
    });

    const ws = WaveSurfer.create({
      container,
      waveColor: "hsl(var(--muted-foreground))",
      progressColor: "hsl(var(--primary))",
      height: 32,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      plugins: [record],
    });

    wavesurferRef.current = ws;
    recordPluginRef.current = record;

    // Handle recorded audio
    record.on("record-end", async (blob: Blob) => {
      if (!mountedRef.current) return;

      const targetFormat = formatRef.current;
      try {
        const converted =
          targetFormat === "wav" ? await convertToWav(blob) : await convertToMp3(blob);
        if (!mountedRef.current) return;

        recordedFormatRef.current = targetFormat;
        const url = URL.createObjectURL(converted);
        setAudioBlob(converted);
        setAudioUrl(url);
        setStatus("recorded");
      } catch (err) {
        console.error(`Error converting audio to ${targetFormat}:`, err);
        // Fallback: use original blob (labeled as mp3 by getAudioFile)
        if (!mountedRef.current) return;
        recordedFormatRef.current = "mp3";
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        setStatus("recorded");
      }
    });

    // Start recording
    await record.startRecording();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    streamRef.current = (record as any).stream ?? null;

    setDuration(0);
    setStatus("recording");

    // Timer
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      if (!mountedRef.current) return;
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setDuration(elapsed);

      if (elapsed >= MAX_DURATION_SECONDS) {
        // Clear timer BEFORE stopping to avoid race
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rp = recordPluginRef.current as any;
        if (rp?.isRecording?.()) {
          rp.stopRecording();
        }
      }
    }, 1000);
  }, [destroyResources]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record = recordPluginRef.current as any;
    if (record?.isRecording?.()) {
      record.stopRecording();
    }

    // Release mic
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const discardRecording = useCallback(() => {
    // Skip record.stopRecording() — it fires record-end (triggering mp3 conversion)
    // and closes WaveSurfer's AudioContext. destroyResources() handles cleanup via ws.destroy().
    destroyResources();

    setStatus("idle");
    setDuration(0);
    setAudioBlob(null);
    setAudioUrl(null);
  }, [destroyResources]);

  const getAudioFile = useCallback((): File | null => {
    if (!audioBlob) return null;
    const isWav = recordedFormatRef.current === "wav";
    const ext = isWav ? "wav" : "mp3";
    const type = isWav ? "audio/wav" : "audio/mpeg";
    return new File([audioBlob], `audio-${Date.now()}.${ext}`, { type });
  }, [audioBlob]);

  return {
    status,
    duration,
    audioBlob,
    audioUrl,
    startRecording,
    stopRecording,
    discardRecording,
    getAudioFile,
    recordWaveformRef,
  };
}
