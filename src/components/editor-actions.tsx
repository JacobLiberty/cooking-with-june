"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { useMutation } from "convex/react";
import { api } from "@cvx/_generated/api";
import {
  toggleWishlist,
  markMade,
  unmarkMade,
} from "@/app/actions/recipe-actions";
import { shouldCelebrate } from "@/lib/celebrate";
import { PawMark } from "@/components/paw-mark";
import { Star } from "@/components/star-rating";
import { useToast } from "@/components/toast";

const MAX_RATING = 5;
const RATING_STEP = 0.5;
const clampRating = (v: number) => Math.max(0, Math.min(MAX_RATING, v));

/**
 * Half-step rating input modelled as a single ARIA slider (0–5, step 0.5).
 * Keyboard: one tab stop plus Arrow/Home/End/PageUp-Down keys, value announced
 * via aria-valuetext. Pointer: the click (and a live hover preview) map the
 * x-position across the five stars to the nearest 0.5 value.
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
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;

  const valueFromX = (clientX: number, el: HTMLElement) => {
    const { left, width } = el.getBoundingClientRect();
    const ratio = (clientX - left) / width;
    const v = clampRating(Math.ceil((ratio * MAX_RATING) / RATING_STEP) * RATING_STEP);
    return Math.max(RATING_STEP, v);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    let next = value;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = clampRating(value + RATING_STEP);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = clampRating(value - RATING_STEP);
        break;
      case "PageUp":
        next = clampRating(value + 1);
        break;
      case "PageDown":
        next = clampRating(value - 1);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = MAX_RATING;
        break;
      default:
        return;
    }
    e.preventDefault();
    if (next !== value) onRate(next);
  };

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    onRate(valueFromX(e.clientX, e.currentTarget));
  };

  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Your rating"
      aria-valuemin={0}
      aria-valuemax={MAX_RATING}
      aria-valuenow={value}
      aria-valuetext={`${value} of ${MAX_RATING} stars`}
      aria-disabled={disabled || undefined}
      onKeyDown={disabled ? undefined : onKeyDown}
      onClick={onClick}
      onMouseMove={
        disabled
          ? undefined
          : (e) => setHover(valueFromX(e.clientX, e.currentTarget))
      }
      onMouseLeave={() => setHover(null)}
      className={`inline-flex items-center rounded outline-offset-4 ${
        disabled ? "" : "cursor-pointer"
      }`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const full = shown >= n;
        const half = !full && shown >= n - 0.5;
        return (
          <span
            key={n}
            className={`inline-flex h-11 w-8 items-center justify-center ${
              full || half ? "text-star" : "text-ink/30"
            }`}
          >
            <Star
              fill={full ? "full" : half ? "half" : "empty"}
              index={n}
              className="h-6 w-6"
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
  const router = useRouter();
  const rateMutation = useMutation(api.ratings.rate);
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
    const prev = myRating;
    setMyRating(v);
    // Optimistic slider; refresh the server-rendered aggregate once it saves,
    // and revert if the write fails.
    rateMutation({ recipeId, value: v })
      .then(() => router.refresh())
      .catch(() => {
        setMyRating(prev);
        toast({ message: "Couldn't save your rating" });
      });
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
