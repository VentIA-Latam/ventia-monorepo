"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Square, Play, Pause, Send } from "lucide-react";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { cn } from "@/lib/utils";

interface AudioRecorderProps {
  onSend: (file: File) => void;
  onCancel: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioRecorder({ onSend, onCancel }: AudioRecorderProps) {
  const {
    status,
    duration,
    audioUrl,
    startRecording,
    stopRecording,
    discardRecording,
    getAudioFile,
    recordWaveformRef,
  } = useAudioRecorder();

  const [isPlaying, setIsPlaying] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedRef = useRef(false);

  // Auto-start recording on mount (only once)
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    startRecording().catch((err) => {
      console.error("Failed to start recording:", err);
      onCancel();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDiscard = useCallback(() => {
    // Stop preview playback before discarding
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    discardRecording();
    onCancel();
  }, [discardRecording, onCancel]);

  const handleStop = useCallback(() => {
    stopRecording();
  }, [stopRecording]);

  const handleSend = useCallback(() => {
    const file = getAudioFile();
    if (file) {
      onSend(file);
    }
  }, [getAudioFile, onSend]);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  // Preview audio timeupdate
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    audio.src = audioUrl;

    const onTimeUpdate = () => setPreviewTime(Math.floor(audio.currentTime));
    const onEnded = () => {
      setIsPlaying(false);
      setPreviewTime(0);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [audioUrl]);

  return (
    <div className="flex items-center gap-2 w-full px-2 py-2">
      {/* Hidden audio element for preview playback */}
      <audio ref={audioRef} className="hidden" />

      {/* Discard button */}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="shrink-0 h-9 w-9 rounded-full text-danger hover:bg-danger/10"
        onClick={handleDiscard}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      {status === "recording" && (
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
        </span>
      )}

      {/* Waveform container - always in DOM so WaveSurfer can mount before status changes */}
      <div
        ref={recordWaveformRef}
        className={cn(
          "flex-1 min-w-0 h-8 rounded",
          status !== "recording" && "hidden"
        )}
      />

      {status === "recording" && (
        <>
          {/* Timer */}
          <span className="text-sm font-mono text-muted-foreground shrink-0 min-w-[3ch]">
            {formatTime(duration)}
          </span>

          {/* Stop button */}
          <Button
            type="button"
            size="icon"
            className="shrink-0 h-10 w-10 rounded-full bg-danger hover:bg-danger/90 text-white"
            onClick={handleStop}
          >
            <Square className="h-4 w-4 fill-current" />
          </Button>
        </>
      )}

      {status === "recorded" && (
        <>
          {/* Play/pause preview */}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="shrink-0 h-9 w-9 rounded-full"
            onClick={handlePlayPause}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>

          {/* Waveform placeholder bar */}
          <div className="flex-1 min-w-0 h-8 bg-muted/30 rounded flex items-center px-2">
            <div
              className="h-1 bg-primary rounded-full transition-all"
              style={{
                width: duration > 0 ? `${Math.min((previewTime / duration) * 100, 100)}%` : "0%",
              }}
            />
          </div>

          {/* Duration */}
          <span className="text-sm font-mono text-muted-foreground shrink-0 min-w-[3ch]">
            {formatTime(duration)}
          </span>

          {/* Send button */}
          <Button
            type="button"
            size="icon"
            className={cn(
              "shrink-0 h-10 w-10 rounded-full",
              "bg-primary hover:bg-primary/90 text-primary-foreground"
            )}
            onClick={handleSend}
          >
            <Send className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}
