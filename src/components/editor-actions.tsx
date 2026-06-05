"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, m } from "motion/react";
import {
  rateRecipe,
  toggleWishlist,
  markMade,
  unmarkMade,
} from "@/app/actions/recipe-actions";
import { shouldCelebrate } from "@/lib/celebrate";
import { PawMark } from "@/components/paw-mark";
import { Star } from "@/components/star-rating";
import { useToast } from "@/components/toast";

/**
 * Half-step rating input: each star is a 44px-tall slot split into two hit
 * targets — the left half sets n−0.5, the right half sets n — so editors can
 * enter the same 0.5-step values the display and "June approved" logic use.
 */
function RatingInput({
  value,
  disabled,
  onRate,
}: {
  value: number;
  disabled: boolean;
  onRate: (v: number) => void;
}) {
  return (
    <div className="flex items-center" role="group" aria-label="Set your rating">
      {[1, 2, 3, 4, 5].map((n) => {
        const full = value >= n;
        const half = !full && value >= n - 0.5;
        return (
          <span
            key={n}
            className={`relative inline-flex h-11 w-8 items-center justify-center ${
              full || half ? "text-star" : "text-ink/30"
            }`}
          >
            <Star
              fill={full ? "full" : half ? "half" : "empty"}
              index={n}
              className="h-6 w-6"
            />
            <button
              type="button"
              disabled={disabled}
              aria-label={`${n - 0.5} stars`}
              aria-pressed={value === n - 0.5}
              onClick={() => onRate(n - 0.5)}
              className="absolute inset-y-0 left-0 w-1/2"
            />
            <button
              type="button"
              disabled={disabled}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              aria-pressed={value === n}
              onClick={() => onRate(n)}
              className="absolute inset-y-0 right-0 w-1/2"
            />
          </span>
        );
      })}
    </div>
  );
}

export function EditorActions({
  recipeId,
  initialMyRating,
  initialWishlist,
}: {
  recipeId: string;
  initialMyRating: number | null;
  initialWishlist: boolean;
}) {
  const [pending, start] = useTransition();
  const [myRating, setMyRating] = useState(initialMyRating ?? 0);
  const [wishlist, setWishlist] = useState(initialWishlist);
  const [celebrate, setCelebrate] = useState(false);
  const [madePop, setMadePop] = useState(false);
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const madeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useToast();

  useEffect(
    () => () => {
      if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
      if (madeTimer.current) clearTimeout(madeTimer.current);
    },
    [],
  );

  const rate = (v: number) => {
    setMyRating(v);
    start(() => rateRecipe(recipeId, v));
    if (shouldCelebrate(v)) {
      setCelebrate(true);
      if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
      celebrateTimer.current = setTimeout(() => setCelebrate(false), 900);
    }
  };

  const made = () => {
    start(() => markMade(recipeId, new Date().toISOString()));
    setMadePop(true);
    if (madeTimer.current) clearTimeout(madeTimer.current);
    madeTimer.current = setTimeout(() => setMadePop(false), 900);
    toast({
      message: "Logged — you made it",
      actionLabel: "Undo",
      onAction: () => start(() => unmarkMade(recipeId)),
    });
  };

  return (
    <section
      className="mt-10 border-t border-terracotta/25 pt-6"
      aria-label="Editor actions"
    >
      <p className="kicker text-terracotta">Your kitchen</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="kicker text-ink-soft">Your rating</span>
          <div className="relative">
            <RatingInput value={myRating} disabled={pending} onRate={rate} />
            {celebrate ? (
              <span className="pointer-events-none absolute inset-0" aria-hidden>
                {[-20, -8, 6, 18].map((x, i) => (
                  <PawMark
                    key={i}
                    className="paw-pop absolute h-4 w-4 text-clay"
                    style={{
                      left: `${x + 70}px`,
                      ["--r" as string]: `${x * 2}deg`,
                    }}
                  />
                ))}
              </span>
            ) : null}
          </div>
        </div>

        <span className="relative inline-flex">
          <button
            type="button"
            disabled={pending}
            onClick={made}
            className="kicker flex min-h-11 items-center rounded-full border border-clay px-4 text-terracotta-deep transition-colors hover:bg-clay-wash disabled:opacity-50"
          >
            Made it
          </button>
          <AnimatePresence>
            {madePop ? (
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

        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setWishlist((w) => !w);
            start(() => toggleWishlist(recipeId));
          }}
          className={`kicker flex min-h-11 items-center rounded-full border px-4 disabled:opacity-50 ${
            wishlist
              ? "border-terracotta bg-terracotta-wash text-terracotta"
              : "border-ink/25 text-ink-soft hover:border-terracotta"
          }`}
        >
          {wishlist ? "On the to-try list" : "Add to to-try"}
        </button>
      </div>
    </section>
  );
}
