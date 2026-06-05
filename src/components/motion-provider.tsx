"use client";

import { LazyMotion, domAnimation, MotionConfig } from "motion/react";

/**
 * App-wide motion setup. `LazyMotion` + the `m` components keep the initial
 * bundle small (~4.6kb vs the full import); `reducedMotion="user"` makes every
 * animation respect the OS "reduce motion" setting.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}
