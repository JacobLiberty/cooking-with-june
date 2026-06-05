"use client";

import { useEffect, useRef, useState } from "react";
import type { StepTimer as Timer } from "@/lib/cook-extras";

function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** A one-tap countdown for a duration detected in a cooking step. */
export function StepTimer({ timer }: { timer: Timer }) {
  const [remaining, setRemaining] = useState(timer.seconds);
  const [running, setRunning] = useState(false);
  const done = running === false && remaining === 0;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          try {
            navigator.vibrate?.(400);
          } catch {
            // vibration unsupported — ignore
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const onClick = () => {
    if (done || (!running && remaining === 0)) {
      setRemaining(timer.seconds);
      setRunning(true);
    } else {
      setRunning((r) => !r);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        running ? `Pause ${timer.label} timer` : `Start ${timer.label} timer`
      }
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-base transition-colors ${
        done
          ? "border-clay bg-clay text-paper"
          : running
            ? "border-terracotta bg-terracotta-wash text-terracotta"
            : "border-terracotta/50 text-terracotta hover:bg-terracotta-wash"
      }`}
    >
      <span aria-hidden>{done ? "✓" : "⏱"}</span>
      <span className="[font-variant-numeric:tabular-nums]">
        {running || remaining < timer.seconds ? mmss(remaining) : timer.label}
      </span>
    </button>
  );
}
