"use client";

import { useState } from "react";

export function ShareButton({ className }: { className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — ignore
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`kicker text-terracotta transition-colors hover:text-terracotta-deep ${className ?? ""}`}
    >
      {copied ? "Link copied!" : "Share"}
    </button>
  );
}
