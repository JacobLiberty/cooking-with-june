"use client";

import { useState } from "react";
import Link from "next/link";
import type { SanityImageSource } from "@sanity/image-url";
import { CheckBox } from "@/components/check-box";
import { RecipeCover } from "@/components/recipe-cover";
import { coverTransitionName } from "@/lib/view-transition";
import { totalTime } from "@/lib/format";

export type MenuRow = {
  recipeId: string;
  title: string;
  slug: string | null;
  coverImage: SanityImageSource | null;
  prepTime: number | null;
  cookTime: number | null;
  servings: number | null;
  scale: number;
  coverage: {
    cookable: boolean;
    missingRequired: number;
    missing: { ingredientId: string; name: string }[];
  };
  optionalIngredients: { id: string; name: string }[];
};

export function MenuRecipeRow({
  row,
  scale,
  onScale,
  onRemove,
  onMadeIt,
  onAddMissing,
  addedMissing,
}: {
  row: MenuRow;
  scale: number;
  onScale: (next: number) => void;
  onRemove: () => void;
  onMadeIt: (usedOptionalIds: string[]) => void;
  onAddMissing: (ingredientId: string, name: string) => void;
  /** Ingredient ids already added to the list from this card. */
  addedMissing: Set<string>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [used, setUsed] = useState<Set<string>>(() => new Set());

  const time = totalTime(row.prepTime, row.cookTime);
  const meta = [
    time,
    row.servings ? `serves ${row.servings}` : null,
    scale !== 1 ? `scale ×${scale}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const toggle = (id: string) =>
    setUsed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const confirm = () => {
    onMadeIt([...used]);
    setConfirming(false);
    setUsed(new Set());
  };

  const cover = (
    <div
      className="aspect-[2.2/1] overflow-hidden border border-ink/15"
      style={{ viewTransitionName: coverTransitionName(row.recipeId) }}
    >
      <RecipeCover
        image={row.coverImage}
        title={row.title}
        sizes="(min-width: 672px) 672px, 100vw"
      />
    </div>
  );

  return (
    <li className="border-b border-terracotta/15 py-6 last:border-b-0">
      {row.slug ? (
        <Link href={`/recipe/${row.slug}`} aria-label={row.title} className="block">
          {cover}
        </Link>
      ) : (
        cover
      )}

      <h2 className="editorial-display mt-3 text-2xl text-ink">
        {row.slug ? (
          <Link href={`/recipe/${row.slug}`} className="hover:text-terracotta">
            {row.title}
          </Link>
        ) : (
          row.title
        )}
      </h2>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        {meta ? <span className="kicker text-ink-soft">{meta}</span> : null}
        {row.coverage.cookable ? (
          <span className="kicker text-clay">Ready to cook</span>
        ) : row.coverage.missingRequired > 0 ? (
          <button
            type="button"
            onClick={() => setShowMissing((v) => !v)}
            aria-expanded={showMissing}
            className="kicker text-terracotta underline-offset-2 hover:underline"
          >
            Missing {row.coverage.missingRequired} — {showMissing ? "hide" : "view"}
          </button>
        ) : null}
      </div>

      {showMissing && row.coverage.missing.length > 0 ? (
        <ul className="mt-2 space-y-1.5 rounded-lg bg-clay-wash/40 p-3">
          {row.coverage.missing.map((m) => (
            <li key={m.ingredientId} className="flex items-center justify-between gap-3">
              <span className="text-ink">{m.name}</span>
              {addedMissing.has(m.ingredientId) ? (
                <span className="kicker text-clay">On the list ✓</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onAddMissing(m.ingredientId, m.name)}
                  className="kicker text-terracotta hover:text-terracotta-deep"
                >
                  Add to list
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => setConfirming((v) => !v)}
          className="kicker rounded-full bg-terracotta px-4 py-1.5 text-paper hover:bg-terracotta-deep"
        >
          Made it
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onScale(scale - 1)}
            aria-label={`Decrease servings for ${row.title}`}
            className="kicker h-8 w-8 rounded-full border border-terracotta/40 text-terracotta hover:bg-terracotta-wash"
          >
            −
          </button>
          <span className="kicker w-8 text-center text-ink" aria-label={`Serving scale ${scale}x`}>
            ×{scale}
          </span>
          <button
            type="button"
            onClick={() => onScale(scale + 1)}
            aria-label={`Increase servings for ${row.title}`}
            className="kicker h-8 w-8 rounded-full border border-terracotta/40 text-terracotta hover:bg-terracotta-wash"
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${row.title} from the menu`}
          className="kicker text-ink-soft hover:text-terracotta"
        >
          Remove
        </button>
      </div>

      {confirming ? (
        <div className="mt-3 rounded-lg bg-clay-wash/40 p-3">
          {row.optionalIngredients.length > 0 ? (
            <>
              <p className="kicker text-ink-soft">Which optional ingredients did you use?</p>
              <ul className="mt-2 space-y-2">
                {row.optionalIngredients.map((o) => (
                  <li key={o.id} className="flex items-center gap-2">
                    <CheckBox
                      checked={used.has(o.id)}
                      onChange={() => toggle(o.id)}
                      label={`Used ${o.name}`}
                    />
                    <span className="text-ink">{o.name}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-ink-soft">Mark as made? This uses up the ingredients.</p>
          )}
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={confirm}
              className="kicker rounded-full bg-terracotta px-4 py-1.5 text-paper hover:bg-terracotta-deep"
            >
              Confirm — made it
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setUsed(new Set());
              }}
              className="kicker text-ink-soft hover:text-terracotta"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
