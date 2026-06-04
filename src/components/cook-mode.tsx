"use client";

import { useState } from "react";
import Link from "next/link";
import { cookProgress } from "@/lib/cook-progress";
import { useWakeLock } from "@/lib/use-wake-lock";
import { PawMark } from "@/components/paw-mark";
import type { IngredientLineView } from "@/sanity/types";

export function CookMode({
  title,
  slug,
  steps,
  ingredients,
}: {
  title: string;
  slug: string;
  steps: string[];
  ingredients: IngredientLineView[];
}) {
  useWakeLock(true);
  const [index, setIndex] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const p = cookProgress(index, steps.length);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col">
      <div className="flex items-center justify-between">
        <Link href={`/recipe/${slug}`} className="kicker text-ink-soft hover:text-olive">
          Exit
        </Link>
        <span className="kicker text-ink-soft">{title}</span>
        <button
          type="button"
          onClick={() => setShowIngredients((s) => !s)}
          className="kicker text-ink-soft hover:text-olive"
          aria-expanded={showIngredients}
        >
          Ingredients
        </button>
      </div>

      {showIngredients ? (
        <ul className="mt-4 rounded-none border border-ink/15 bg-paper-sunk p-4 [font-variant-numeric:tabular-nums]">
          {ingredients.map((line) => (
            <li key={line._key} className="text-ink">
              <span className="text-ink-soft">
                {[line.quantity, line.unit].filter(Boolean).join(" ")}
              </span>{" "}
              {line.name ?? "—"}
            </li>
          ))}
        </ul>
      ) : null}

      {/* pawprint progress */}
      <div className="mt-8 flex items-center gap-2" aria-hidden>
        {steps.map((_, i) => (
          <PawMark
            key={i}
            className={`h-4 w-4 ${i <= p.current ? "text-clay" : "text-ink/20"}`}
          />
        ))}
      </div>

      <div className="mt-6 flex flex-1 flex-col justify-center">
        <p className="kicker text-olive">
          Step {p.total === 0 ? 0 : p.current + 1} of {p.total}
        </p>
        <p className="mt-3 text-3xl leading-snug text-ink md:text-5xl">
          {steps[p.current] ?? "No steps yet."}
        </p>
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-olive/25 pt-4">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(i - 1, 0))}
          disabled={p.current === 0}
          aria-label="Back"
          className="kicker text-ink-soft hover:text-olive disabled:opacity-30"
        >
          ← Back
        </button>
        {p.isLast ? (
          <Link
            href={`/recipe/${slug}`}
            className="kicker border border-clay px-4 py-2 text-clay hover:bg-clay-wash"
          >
            Done
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(i + 1, steps.length - 1))}
            aria-label="Next"
            className="kicker border border-olive px-4 py-2 text-olive hover:bg-olive-wash"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
