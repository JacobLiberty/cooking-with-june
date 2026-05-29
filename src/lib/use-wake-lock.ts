"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps the screen awake while mounted, using the Wake Lock API.
 * No-ops gracefully where unsupported (older Safari, insecure contexts).
 * Re-acquires the lock when the tab becomes visible again.
 */
export function useWakeLock(active: boolean = true) {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    async function acquire() {
      try {
        if (typeof navigator === "undefined") return;
        if (!("wakeLock" in navigator)) return;
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await sentinel.release().catch(() => {});
          return;
        }
        lockRef.current = sentinel;
      } catch {
        // permission denied / not allowed — silently degrade
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible" && !lockRef.current) {
        void acquire();
      }
    }

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [active]);
}
