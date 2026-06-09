"use client";

import { useEffect, useRef, useState } from "react";

export function ShareButton({ className }: { className?: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus("copied");
    } catch {
      // clipboard unavailable (insecure context / unsupported) — tell the user
      setStatus("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), 1800);
  }

  const label =
    status === "copied"
      ? "Link copied!"
      : status === "failed"
        ? "Copy failed — long-press the URL"
        : "Share";

  return (
    <button
      type="button"
      onClick={copy}
      className={`kicker transition-colors ${status === "failed" ? "text-terracotta-deep" : "text-terracotta hover:text-terracotta-deep"} ${className ?? ""}`}
    >
      {label}
    </button>
  );
}
