"use client";

import { useState } from "react";
import {
  formatCanonicalAmount,
  canonicalUnitLabel,
  pantryNudgeStep,
  type DisplayKind,
} from "@/lib/kitchen/format-amount";

export type PantryRowData = {
  ingredientId: string;
  name: string;
  quantityG: number;
  canonicalUnitKind: DisplayKind;
  restockOverride: { quantity: number; unit: string } | null;
  restockDefault: { quantity: number; unit: string } | null;
};

export function PantryRow({
  row,
  onSetQuantity,
  onSetRestock,
  onClearRestock,
}: {
  row: PantryRowData;
  onSetQuantity: (next: number) => void;
  onSetRestock: (restock: { quantity: number; unit: string }) => void;
  onClearRestock: () => void;
}) {
  const unit = canonicalUnitLabel(row.canonicalUnitKind);
  const step = pantryNudgeStep(row.canonicalUnitKind);
  const [draft, setDraft] = useState(String(row.quantityG));
  const [editingRestock, setEditingRestock] = useState(false);

  // Keep the input in sync when the parent's optimistic value changes.
  const synced = String(row.quantityG);
  const [lastSynced, setLastSynced] = useState(synced);
  if (synced !== lastSynced) {
    setLastSynced(synced);
    setDraft(synced);
  }

  const commit = (value: number) => {
    const next = Math.max(0, Math.round(value * 10) / 10);
    onSetQuantity(next);
    setDraft(String(next));
  };

  const restock = row.restockOverride ?? row.restockDefault;

  return (
    <li className="flex flex-col gap-2 border-b border-terracotta/15 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="flex-1 text-ink">{row.name}</span>
        <span className="kicker text-ink-soft" aria-hidden>
          {formatCanonicalAmount(row.quantityG, row.canonicalUnitKind)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => commit(row.quantityG - step)}
          aria-label={`Decrease ${row.name}`}
          className="kicker h-8 w-8 rounded-full border border-terracotta/40 text-terracotta hover:bg-terracotta-wash"
        >
          −
        </button>
        <label className="flex items-center gap-1">
          <span className="sr-only">{row.name} quantity</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
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
            className="w-20 border-b border-ink/25 bg-transparent pb-1 text-right text-ink focus:border-terracotta"
          />
          <span className="kicker text-ink-soft">{unit}</span>
        </label>
        <button
          type="button"
          onClick={() => commit(row.quantityG + step)}
          aria-label={`Increase ${row.name}`}
          className="kicker h-8 w-8 rounded-full border border-terracotta/40 text-terracotta hover:bg-terracotta-wash"
        >
          +
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm">
        {editingRestock ? (
          <RestockEditor
            initial={restock}
            onSave={(r) => {
              onSetRestock(r);
              setEditingRestock(false);
            }}
            onCancel={() => setEditingRestock(false)}
          />
        ) : (
          <>
            <span className="text-ink-soft">
              Restock:{" "}
              {restock ? `${restock.quantity} ${restock.unit}`.trim() : "—"}
              {row.restockOverride ? " (custom)" : ""}
            </span>
            <button
              type="button"
              onClick={() => setEditingRestock(true)}
              className="kicker text-terracotta hover:text-terracotta-deep"
            >
              Edit
            </button>
            {row.restockOverride ? (
              <button
                type="button"
                onClick={onClearRestock}
                className="kicker text-ink-soft hover:text-terracotta"
              >
                Reset
              </button>
            ) : null}
          </>
        )}
      </div>
    </li>
  );
}

function RestockEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: { quantity: number; unit: string } | null;
  onSave: (r: { quantity: number; unit: string }) => void;
  onCancel: () => void;
}) {
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? ""));
  const [unit, setUnit] = useState(initial?.unit ?? "");
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const q = Number(quantity);
        if (!Number.isFinite(q) || q <= 0) return;
        onSave({ quantity: q, unit: unit.trim() });
      }}
    >
      <input
        type="number"
        min={0}
        step="any"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        aria-label="Restock quantity"
        className="w-16 border-b border-ink/25 bg-transparent pb-1 text-ink focus:border-terracotta"
      />
      <input
        type="text"
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
        aria-label="Restock unit"
        placeholder="unit"
        maxLength={20}
        className="w-20 border-b border-ink/25 bg-transparent pb-1 text-ink focus:border-terracotta"
      />
      <button type="submit" className="kicker text-terracotta hover:text-terracotta-deep">
        Save
      </button>
      <button type="button" onClick={onCancel} className="kicker text-ink-soft hover:text-terracotta">
        Cancel
      </button>
    </form>
  );
}
