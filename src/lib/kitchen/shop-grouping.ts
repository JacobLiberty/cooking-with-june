import { formatCanonicalAmount, type DisplayKind } from "@/lib/kitchen/format-amount";

export type ShopNeed = {
  ingredientId: string;
  name: string;
  amount: number;
  optional: boolean;
  category: string | null;
  canonicalUnitKind: DisplayKind;
};

export type ShopManual = {
  ingredientId: string;
  source: "manual";
  manualQuantity: { quantity: number; unit: string } | null;
  name: string;
  canonicalUnitKind: DisplayKind;
  category: string | null;
};

export type ShopItem = {
  ingredientId: string;
  name: string;
  category: string | null;
  optional: boolean;
  source: "need" | "manual";
  amount: number | null; // canonical amount for needs
  canonicalUnitKind: DisplayKind;
  manualQuantity: { quantity: number; unit: string } | null;
};

/** Store-aisle display order; unknown/`other` falls into "other". */
export const STORE_CATEGORY_ORDER = [
  "produce",
  "dairy",
  "protein",
  "pantry",
  "spice",
  "other",
  "nonfood",
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  produce: "Produce",
  dairy: "Dairy",
  protein: "Protein",
  pantry: "Pantry",
  spice: "Spice & seasoning",
  other: "Other",
  nonfood: "Non-food",
  optional: "Nice to have",
};

export function buildShopItems(needs: ShopNeed[], manual: ShopManual[]): ShopItem[] {
  return [
    ...needs.map((n) => ({
      ingredientId: n.ingredientId,
      name: n.name,
      category: n.category,
      optional: n.optional,
      source: "need" as const,
      amount: n.amount,
      canonicalUnitKind: n.canonicalUnitKind,
      manualQuantity: null,
    })),
    ...manual.map((m) => ({
      ingredientId: m.ingredientId,
      name: m.name,
      category: m.category,
      optional: false,
      source: "manual" as const,
      amount: null,
      canonicalUnitKind: m.canonicalUnitKind,
      manualQuantity: m.manualQuantity,
    })),
  ];
}

const categoryKey = (category: string | null): string => {
  if (category && (STORE_CATEGORY_ORDER as readonly string[]).includes(category)) return category;
  return "other";
};

export type ShopGroup = { key: string; label: string; items: ShopItem[] };

/**
 * Group items by store category in aisle order, with all optional items pulled
 * into a single "Nice to have" group pinned last. Empty groups are omitted;
 * items are sorted alphabetically within each group.
 */
export function groupShopItems(items: ShopItem[]): ShopGroup[] {
  const byKey = new Map<string, ShopItem[]>();
  for (const item of items) {
    const key = item.optional ? "optional" : categoryKey(item.category);
    const list = byKey.get(key) ?? [];
    list.push(item);
    byKey.set(key, list);
  }

  const groups: ShopGroup[] = [];
  for (const key of STORE_CATEGORY_ORDER) {
    const list = byKey.get(key);
    if (list && list.length) {
      groups.push({ key, label: CATEGORY_LABELS[key], items: sortByName(list) });
    }
  }
  const optional = byKey.get("optional");
  if (optional && optional.length) {
    groups.push({ key: "optional", label: CATEGORY_LABELS.optional, items: sortByName(optional) });
  }
  return groups;
}

const sortByName = (items: ShopItem[]): ShopItem[] =>
  [...items].sort((a, b) => a.name.localeCompare(b.name));

/** Display amount for a row: a need's canonical amount, or a manual's free-text quantity. */
export function shopItemAmountLabel(item: ShopItem): string {
  if (item.source === "need" && item.amount != null) {
    return formatCanonicalAmount(item.amount, item.canonicalUnitKind);
  }
  if (item.manualQuantity) {
    return `${item.manualQuantity.quantity} ${item.manualQuantity.unit}`.trim();
  }
  return "";
}
