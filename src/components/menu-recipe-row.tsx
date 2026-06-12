"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckBox } from "@/components/check-box";

export type MenuRow = {
  recipeId: string;
  title: string;
  slug: string | null;
  scale: number;
  coverage: { cookable: boolean; missingRequired: number };
  optionalIngredients: { id: string; name: string }[];
};

export function MenuRecipeRow({
  row,
  scale,
  onScale,
  onRemove,
  onMadeIt,
}: {
  row: MenuRow;
  scale: number;
  onScale: (next: number) => void;
  onRemove: () => void;
  onMadeIt: (usedOptionalIds: string[]) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [used, setUsed] = useState<Set<string>>(() => new Set());

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

  return (
    <li className="border-b border-terracotta/15 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {row.slug ? (
            <Link href={`/recipe/${row.slug}`} className="text-ink hover:text-terracotta">
              {row.title}
            </Link>
          ) : (
            <span className="text-ink">{row.title}</span>
          )}
          <div className="mt-1">
            {row.coverage.cookable ? (
              <span className="kicker text-clay">Ready to cook</span>
            ) : (
              <span className="kicker text-terracotta">
                Missing {row.coverage.missingRequired}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
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
      </div>

      <div className="mt-3 flex items-center gap-4">
        <button
          type="button"
          onClick={() => setConfirming((v) => !v)}
          className="kicker rounded-full bg-terracotta px-4 py-1.5 text-paper hover:bg-terracotta-deep"
        >
          Made it
        </button>
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
