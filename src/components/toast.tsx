"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { AnimatePresence, m } from "motion/react";

type ToastInput = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};
type Toast = ToastInput & { id: number };

const ToastContext = createContext<(t: ToastInput) => void>(() => {});

/** Show a transient, on-brand toast (optionally with an Undo action). */
export function useToast() {
  return useContext(ToastContext);
}

const DISMISS_MS = 6000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
    const tm = timers.current.get(id);
    if (tm) {
      clearTimeout(tm);
      timers.current.delete(id);
    }
  }, []);

  const resume = useCallback(
    (id: number) => {
      if (timers.current.has(id)) return;
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DISMISS_MS),
      );
    },
    [dismiss],
  );

  // Pause the auto-dismiss while the toast is hovered or focused, so keyboard
  // and screen-reader users have time to reach the Undo action.
  const pause = useCallback((id: number) => {
    const tm = timers.current.get(id);
    if (tm) {
      clearTimeout(tm);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (input: ToastInput) => {
      const id = (idRef.current += 1);
      setToasts((ts) => [...ts, { ...input, id }]);
      resume(id);
    },
    [resume],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
        role="status"
        aria-atomic="true"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <m.div
              key={t.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onMouseEnter={() => pause(t.id)}
              onMouseLeave={() => resume(t.id)}
              onFocusCapture={() => pause(t.id)}
              onBlurCapture={() => resume(t.id)}
              className="pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-4 rounded-full border border-terracotta/30 bg-ink px-5 py-2.5 text-paper shadow-lg"
            >
              <span className="text-sm">{t.message}</span>
              {t.actionLabel ? (
                <button
                  type="button"
                  onClick={() => {
                    t.onAction?.();
                    dismiss(t.id);
                  }}
                  className="kicker text-clay-wash underline-offset-2 hover:underline"
                >
                  {t.actionLabel}
                </button>
              ) : null}
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
