"use client";

import { useState } from "react";
import {
  shopItemMetaLabel,
  type ShopItem,
} from "@/lib/kitchen/shop-grouping";
import {
  formatCanonicalAmount,
  pantryNudgeStep,
} from "@/lib/kitchen/format-amount";
import { CheckBox } from "@/components/check-box";

export function ShopItemRow({
  item,
  checked,
  expanded,
  onBuy,
  onDismiss,
  onToggleExpand,
  onSetBuyQuantity,
}: {
  item: ShopItem;
  checked: boolean;
  expanded: boolean;
  onBuy: () => void;
  onDismiss: () => void;
  onToggleExpand: () => void;
  onSetBuyQuantity: (next: number) => void;
}) {
  const meta = checked
    ? item.buyQuantityG != null
      ? `added ${formatCanonicalAmount(item.buyQuantityG, item.canonicalUnitKind)} to pantry`
      : "checked off"
    : shopItemMetaLabel(item);
  const editable = !checked && item.buyQuantityG != null;

  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-terracotta/15 py-2.5">
      <CheckBox checked={checked} onChange={checked ? () => {} : onBuy} label={`Got ${item.name}`} />
      <div className="min-w-0 flex-1">
        <span className={`block text-ink ${checked ? "text-ink-soft line-through" : ""}`}>
          {item.name}
        </span>
        {meta ? (
          editable ? (
            <button
              type="button"
              onClick={onToggleExpand}
              aria-expanded={expanded}
              aria-label={`Adjust buy quantity for ${item.name}`}
              className="text-sm text-ink-soft hover:text-terracotta"
            >
              {meta}
            </button>
          ) : (
            <span className="block text-sm text-ink-soft">{meta}</span>
          )
        ) : null}
      </div>
      {!checked ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={`Won't buy ${item.name}`}
          className="kicker text-ink-soft hover:text-terracotta"
        >
          Won&rsquo;t buy
        </button>
      ) : null}
      {expanded && editable && item.buyQuantityG != null ? (
        <BuyQuantityEditor
          name={item.name}
          value={item.buyQuantityG}
          kind={item.canonicalUnitKind}
          onCommit={onSetBuyQuantity}
        />
      ) : null}
    </li>
  );
}

function BuyQuantityEditor({
  name,
  value,
  kind,
  onCommit,
}: {
  name: string;
  value: number;
  kind: ShopItem["canonicalUnitKind"];
  onCommit: (next: number) => void;
}) {
  const step = pantryNudgeStep(kind);
  const [draft, setDraft] = useState(String(value));

  // Keep the input in sync with the optimistic parent value.
  const synced = String(value);
  const [lastSynced, setLastSynced] = useState(synced);
  if (synced !== lastSynced) {
    setLastSynced(synced);
    setDraft(synced);
  }

  const commit = (next: number) => {
    const rounded = Math.max(1, Math.round(next));
    setDraft(String(rounded));
    if (rounded !== value) onCommit(rounded);
  };

  return (
    <div className="flex basis-full items-center gap-2 pb-1 pl-9">
      <button
        type="button"
        onClick={() => commit(value - step)}
        aria-label={`Decrease buy quantity for ${name}`}
        className="kicker h-7 w-7 rounded-full border border-terracotta/40 text-terracotta hover:bg-terracotta-wash"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(Number(draft) || value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(Number(draft) || value);
          }
        }}
        aria-label={`Buy quantity for ${name}`}
        className="w-16 border-b border-ink/25 bg-transparent pb-1 text-right text-ink focus:border-terracotta"
      />
      <button
        type="button"
        onClick={() => commit(value + step)}
        aria-label={`Increase buy quantity for ${name}`}
        className="kicker h-7 w-7 rounded-full border border-terracotta/40 text-terracotta hover:bg-terracotta-wash"
      >
        +
      </button>
      <span className="editorial-aside text-sm text-ink-soft">adjust what you&rsquo;re buying</span>
    </div>
  );
}
