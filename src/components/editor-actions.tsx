"use client";

import { useState, useTransition } from "react";
import { rateRecipe, toggleWishlist, markMade } from "@/app/actions/recipe-actions";

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

  const rate = (v: number) => {
    setMyRating(v);
    start(() => rateRecipe(recipeId, v));
  };

  return (
    <section className="mt-10 border-t border-clay/30 pt-6" aria-label="Editor actions">
      <p className="kicker text-clay">Your kitchen</p>
      <div className="mt-3 flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="kicker text-ink-soft">Your rating</span>
          <div className="flex gap-1" role="group" aria-label="Set your rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                aria-pressed={myRating >= n}
                onClick={() => rate(n)}
                disabled={pending}
                className={`text-2xl leading-none ${myRating >= n ? "text-ochre" : "text-ink/25"} hover:text-ochre`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => markMade(recipeId, new Date().toISOString()))}
          className="kicker border border-clay px-3 py-1 text-clay hover:bg-clay-wash"
        >
          Made it
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setWishlist((w) => !w);
            start(() => toggleWishlist(recipeId));
          }}
          className={`kicker border px-3 py-1 ${wishlist ? "border-heather bg-heather-wash text-heather" : "border-ink/25 text-ink-soft hover:border-heather"}`}
        >
          {wishlist ? "On the to-try list" : "Add to to-try"}
        </button>
      </div>
    </section>
  );
}
