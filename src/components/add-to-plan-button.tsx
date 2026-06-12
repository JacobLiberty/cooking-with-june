"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { addToPlan, removeFromPlan } from "@/app/actions/kitchen-actions";
import { PawMark } from "@/components/paw-mark";

export function AddToPlanButton({
  recipeId,
  inPlan,
}: {
  recipeId: string;
  inPlan: boolean;
}) {
  const [pending, start] = useTransition();
  const [celebrate, setCelebrate] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function go() {
    start(async () => {
      if (inPlan) {
        await removeFromPlan(recipeId);
      } else {
        // pick up the serving scale chosen on this page (if any)
        let scale = 1;
        try {
          const v = parseFloat(
            window.localStorage.getItem(`cwj:recipe-scale:${recipeId}`) ?? "",
          );
          if (Number.isFinite(v) && v > 0) scale = v;
        } catch {
          // ignore
        }
        await addToPlan(recipeId, scale);
        setCelebrate(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCelebrate(false), 900);
      }
      router.refresh();
    });
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={go}
        disabled={pending}
        aria-pressed={inPlan}
        className={`kicker transition-colors disabled:opacity-50 ${
          inPlan
            ? "rounded-full bg-terracotta-wash px-2.5 py-0.5 text-terracotta hover:bg-terracotta-wash/70"
            : "text-terracotta hover:text-terracotta-deep"
        }`}
      >
        {inPlan ? "In your plan ✓" : "Add to plan"}
      </button>
      <AnimatePresence>
        {celebrate ? (
          <m.span
            initial={{ opacity: 0, y: 2, scale: 0.6 }}
            animate={{ opacity: 1, y: -30, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
            aria-hidden
          >
            <PawMark className="h-5 w-5 text-clay" />
          </m.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
