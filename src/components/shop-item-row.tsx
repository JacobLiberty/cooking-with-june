"use client";

import { shopItemAmountLabel, type ShopItem } from "@/lib/kitchen/shop-grouping";
import { CheckBox } from "@/components/check-box";

export function ShopItemRow({
  item,
  big = false,
  checked = false,
  onBuy,
  onDismiss,
}: {
  item: ShopItem;
  big?: boolean;
  checked?: boolean;
  onBuy: () => void;
  onDismiss: () => void;
}) {
  const amount = shopItemAmountLabel(item);
  const dismissLabel = item.source === "manual" ? "Remove" : "Skip";
  return (
    <li className={`flex items-center gap-3 ${big ? "py-3" : "py-2"}`}>
      <CheckBox checked={checked} onChange={onBuy} label={`Got ${item.name}`} />
      <span className={`flex-1 text-ink ${big ? "text-lg" : ""} ${checked ? "text-ink-soft line-through" : ""}`}>
        {item.name}
        {amount ? <span className="text-ink-soft"> · {amount}</span> : null}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={`${dismissLabel} ${item.name}`}
        className="kicker text-ink-soft hover:text-terracotta"
      >
        {dismissLabel}
      </button>
    </li>
  );
}
