"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mp3Encoder } from "lamejs";

export type RecorderStatus = "idle" | "recording" | "recorded";

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
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const encoder = new Mp3Encoder(channels, sampleRate, 128);

  const left = formatFloat32ToInt16(audioBuffer.getChannelData(0));
  const right =
    channels > 1
      ? formatFloat32ToInt16(audioBuffer.getChannelData(1))
      : undefined;

  const mp3Chunks: BlobPart[] = [];
  const chunkSize = 1152;

  for (let i = 0; i < left.length; i += chunkSize) {
    const leftChunk = left.subarray(i, i + chunkSize);
    const rightChunk = right?.subarray(i, i + chunkSize);
    const encoded = encoder.encodeBuffer(leftChunk, rightChunk);
    if (encoded.length > 0) mp3Chunks.push(new Uint8Array(encoded) as BlobPart);
  }

  const final = encoder.flush();
  if (final.length > 0) mp3Chunks.push(new Uint8Array(final) as BlobPart);

  await audioContext.close();
  return new Blob(mp3Chunks, { type: "audio/mpeg" });
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const recordWaveformRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<unknown>(null);
  const recordPluginRef = useRef<unknown>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ws = wavesurferRef.current as any;
    if (ws) {
      try { ws.destroy(); } catch { /* ignore */ }
      wavesurferRef.current = null;
    }
    recordPluginRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, [audioUrl]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices) {
      throw new Error("El navegador no soporta grabación de audio");
    }

    // Dynamic import to avoid SSR issues
    const WaveSurfer = (await import("wavesurfer.js")).default;
    const RecordPlugin = (await import("wavesurfer.js/dist/plugins/record.esm.js")).default;

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

      try {
        const mp3Blob = await convertToMp3(blob);
        if (!mountedRef.current) return;

        const url = URL.createObjectURL(mp3Blob);
        setAudioBlob(mp3Blob);
        setAudioUrl(url);
        setStatus("recorded");
      } catch (err) {
        console.error("Error converting audio to MP3:", err);
        // Fallback: use original blob
        if (!mountedRef.current) return;
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rp = recordPluginRef.current as any;
        if (rp?.isRecording?.()) {
          rp.stopRecording();
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    }, 1000);
  }, []);

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
    // Stop if still recording
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record = recordPluginRef.current as any;
    if (record?.isRecording?.()) {
      record.stopRecording();
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (audioUrl) URL.revokeObjectURL(audioUrl);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ws = wavesurferRef.current as any;
    if (ws) {
      try { ws.destroy(); } catch { /* ignore */ }
      wavesurferRef.current = null;
    }
    recordPluginRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    setStatus("idle");
    setDuration(0);
    setAudioBlob(null);
    setAudioUrl(null);
  }, [audioUrl]);

  const getAudioFile = useCallback((): File | null => {
    if (!audioBlob) return null;
    return new File([audioBlob], `audio-${Date.now()}.mp3`, {
      type: "audio/mpeg",
    });
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
