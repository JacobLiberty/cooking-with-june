"use client";

import { useState } from "react";
import {
  canonicalUnitLabel,
  pantryNudgeStep,
  type DisplayKind,
} from "@/lib/kitchen/format-amount";

export type PantryRowData = {
  ingredientId: string;
  name: string;
  quantityG: number;
  canonicalUnitKind: DisplayKind;
  category: string | null;
  /** A manual grocery row already exists — cart action shows as added. */
  onList: boolean;
};

export function PantryRow({
  row,
  onSetQuantity,
  onAddToList,
  onDeplete,
}: {
  row: PantryRowData;
  onSetQuantity: (next: number) => void;
  onAddToList: () => void;
  onDeplete: () => void;
}) {
  const unit = canonicalUnitLabel(row.canonicalUnitKind);
  const step = pantryNudgeStep(row.canonicalUnitKind);
  const [draft, setDraft] = useState(String(row.quantityG));

  // Keep the input in sync when the parent's optimistic value changes.
  const synced = String(row.quantityG);
  const [lastSynced, setLastSynced] = useState(synced);
  if (synced !== lastSynced) {
    setLastSynced(synced);
    setDraft(synced);
  }

  const commit = (value: number) => {
    const next = Math.max(0, Math.round(value));
    onSetQuantity(next);
    setDraft(String(next));
  };

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-2 border-b border-terracotta/15 py-2">
      <span className="truncate text-ink" title={row.name}>
        {row.name}
      </span>

      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => commit(row.quantityG - step)}
          aria-label={`Decrease ${row.name}`}
          className="kicker h-7 w-7 rounded-full border border-terracotta/40 text-terracotta hover:bg-terracotta-wash"
        >
          −
        </button>
        <label className="flex items-center gap-1">
          <span className="sr-only">{row.name} quantity</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit(Number(draft) || 0)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit(Number(draft) || 0);
              }
            }}
            aria-label={`${row.name} quantity in ${unit}`}
            className="w-16 border-b border-ink/25 bg-transparent pb-0.5 text-right text-ink focus:border-terracotta"
          />
          <span className="kicker w-10 text-ink-soft">{unit}</span>
        </label>
        <button
          type="button"
          onClick={() => commit(row.quantityG + step)}
          aria-label={`Increase ${row.name}`}
          className="kicker h-7 w-7 rounded-full border border-terracotta/40 text-terracotta hover:bg-terracotta-wash"
        >
          +
        </button>
      </div>

      <button
        type="button"
        onClick={onAddToList}
        disabled={row.onList}
        title={row.onList ? "Already on your grocery list" : "Add to grocery list"}
        aria-label={
          row.onList
            ? `${row.name} is already on your grocery list`
            : `Add ${row.name} to grocery list`
        }
        className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
          row.onList ? "text-clay" : "text-terracotta hover:bg-terracotta-wash"
        } disabled:cursor-default`}
      >
        <CartIcon />
      </button>

      <button
        type="button"
        onClick={onDeplete}
        title="Out of it — remove from pantry"
        aria-label={`Out of ${row.name} — remove from pantry`}
        className="flex h-7 w-7 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-terracotta-wash hover:text-terracotta"
      >
        <XIcon />
      </button>
    </li>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.25 w-4.25" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
      <path d="M3 4h2l2.6 12h10.2l2-8H6.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.25 w-4.25" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}
