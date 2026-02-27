"use client";

import { useEffect, useRef, useState, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  src: string;
  isOutgoing: boolean;
}

const SPEEDS = [1, 1.5, 2] as const;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const AudioPlayer = memo(function AudioPlayer({
  src,
  isOutgoing,
}: AudioPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<unknown>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isMounted = true;
    let ws: unknown = null;

    (async () => {
      const WaveSurfer = (await import("wavesurfer.js")).default;

      if (!isMounted) return;

      ws = WaveSurfer.create({
        container,
        waveColor: isOutgoing
          ? "oklch(0.55 0.08 230 / 0.4)"
          : "oklch(0.55 0.03 250 / 0.25)",
        progressColor: isOutgoing
          ? "oklch(0.33 0.10 255)"
          : "oklch(0.58 0.19 260)",
        height: 32,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        cursorWidth: 0,
        url: src,
        dragToSeek: true,
      });

      wavesurferRef.current = ws;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const surfer = ws as any;

      surfer.on("ready", () => {
        if (!isMounted) return;
        setTotalDuration(surfer.getDuration());
        setIsReady(true);
      });

      surfer.on("timeupdate", (time: number) => {
        if (!isMounted) return;
        setCurrentTime(time);
      });

      surfer.on("play", () => isMounted && setIsPlaying(true));
      surfer.on("pause", () => isMounted && setIsPlaying(false));
      surfer.on("finish", () => {
        if (!isMounted) return;
        setIsPlaying(false);
        setCurrentTime(0);
      });
    })();

    return () => {
      isMounted = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const surfer = ws as any;
      if (surfer) {
        try { surfer.destroy(); } catch { /* ignore */ }
      }
      wavesurferRef.current = null;
    };
  }, [src, isOutgoing]);

  const handlePlayPause = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const surfer = wavesurferRef.current as any;
    if (surfer) surfer.playPause();
  }, []);

  const handleSpeed = useCallback(() => {
    const nextIndex = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(nextIndex);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const surfer = wavesurferRef.current as any;
    if (surfer) surfer.setPlaybackRate(SPEEDS[nextIndex]);
  }, [speedIndex]);

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg px-2 py-1.5 min-w-[220px] max-w-[300px]",
        !isReady && "opacity-50"
      )}
    >
      {/* Play/Pause */}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={cn(
          "shrink-0 h-8 w-8 rounded-full",
          isOutgoing
            ? "text-white/90 hover:bg-white/10"
            : "text-foreground hover:bg-muted/60"
        )}
        onClick={handlePlayPause}
        disabled={!isReady}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>

      {/* Waveform */}
      <div ref={containerRef} className="flex-1 min-w-0" />

      {/* Time */}
      <span
        className={cn(
          "text-[11px] font-mono shrink-0 min-w-[3ch]",
          isOutgoing ? "text-white/70" : "text-muted-foreground"
        )}
      >
        {isPlaying || currentTime > 0
          ? formatTime(currentTime)
          : formatTime(totalDuration)}
      </span>

      {/* Speed */}
      <button
        type="button"
        className={cn(
          "text-[10px] font-bold shrink-0 rounded px-1 py-0.5 transition-colors",
          isOutgoing
            ? "text-white/70 hover:bg-white/10"
            : "text-muted-foreground hover:bg-muted/60"
        )}
        onClick={handleSpeed}
        disabled={!isReady}
      >
        {SPEEDS[speedIndex]}x
      </button>
    </div>
  );
});
