"use client";

import { useEffect, useState } from "react";
import type { IngredientLineView } from "@/sanity/types";
import { scaleQuantity, servingFactor } from "@/lib/scale";
import { CheckBox } from "@/components/check-box";

/**
 * Interactive ingredient list: tap to cross items off (persisted per recipe in
 * localStorage) and a serving stepper that rescales quantities in place.
 */
export function RecipeIngredients({
  recipeId,
  baseServings,
  ingredients,
}: {
  recipeId: string;
  baseServings?: number | null;
  ingredients: IngredientLineView[];
}) {
  const [servings, setServings] = useState(baseServings ?? 0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const storageKey = `cwj:recipe-checks:${recipeId}`;

  // Restore checked state after mount. Doing this in an effect (rather than a
  // lazy initializer) keeps server and first client render identical, avoiding
  // a hydration mismatch; the restore is a deliberate post-mount update.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setChecked(new Set(JSON.parse(raw) as string[]));
    } catch {
      // ignore unavailable / corrupt storage
    }
  }, [storageKey]);

  const persist = (next: Set<string>) => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch {
      // ignore
    }
  };

  const toggle = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      persist(next);
      return next;
    });
  };

  const factor = servingFactor(baseServings, servings || (baseServings ?? 1));
  const canScale = Boolean(baseServings && baseServings > 0);

  return (
    <div>
      {canScale ? (
        <div className="flex items-center gap-3">
          <span className="kicker text-ink-soft">Servings</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setServings((s) => Math.max(1, s - 1))}
              disabled={servings <= 1}
              aria-label="Fewer servings"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-ink/25 text-ink hover:border-terracotta hover:text-terracotta disabled:opacity-30"
            >
              −
            </button>
            <span
              className="min-w-6 text-center text-lg text-ink [font-variant-numeric:tabular-nums]"
              aria-live="polite"
            >
              {servings}
            </span>
            <button
              type="button"
              onClick={() => setServings((s) => s + 1)}
              aria-label="More servings"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-ink/25 text-ink hover:border-terracotta hover:text-terracotta"
            >
              +
            </button>
            {factor !== 1 ? (
              <button
                type="button"
                onClick={() => setServings(baseServings ?? 0)}
                className="kicker text-ink-soft hover:text-terracotta"
              >
                Reset
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <ul className="mt-4 space-y-2 [font-variant-numeric:tabular-nums]">
        {ingredients.map((line) => {
          const isChecked = checked.has(line._key);
          const qty = [scaleQuantity(line.quantity, factor), line.unit]
            .filter(Boolean)
            .join(" ");
          return (
            <li key={line._key} className="flex items-start gap-3 border-b border-ink/10 pb-2">
              <span className="pt-0.5">
                <CheckBox
                  checked={isChecked}
                  onChange={() => toggle(line._key)}
                  label={`Cross off ${line.name ?? "ingredient"}`}
                />
              </span>
              <span className={isChecked ? "text-ink-soft line-through" : "text-ink"}>
                {qty ? <span className="text-ink-soft">{qty} </span> : null}
                {line.name ?? "—"}
                {line.note ? (
                  <span className="italic text-ink-soft"> ({line.note})</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
