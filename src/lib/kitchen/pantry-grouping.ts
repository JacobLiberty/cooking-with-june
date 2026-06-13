import { STORE_CATEGORY_ORDER, CATEGORY_LABELS } from "@/lib/kitchen/shop-grouping";

export type PantryGroup<T> = { key: string; label: string; rows: T[] };

/** Pantry aisle order — same as Shop, but nonfood folds into Other. */
const PANTRY_ORDER = STORE_CATEGORY_ORDER.filter((k) => k !== "nonfood");

const categoryKey = (category: string | null): string =>
  category && (PANTRY_ORDER as readonly string[]).includes(category) ? category : "other";

/**
 * Group pantry rows by store category in aisle order (Produce → Dairy →
 * Protein → Pantry → Spice & seasoning → Other), alphabetical within each
 * group. Unknown and nonfood categories fold into Other; empty groups omitted.
 */
export function groupPantryRows<T extends { name: string; category: string | null }>(
  rows: T[],
): PantryGroup<T>[] {
  const byKey = new Map<string, T[]>();
  for (const r of rows) {
    const key = categoryKey(r.category);
    const list = byKey.get(key) ?? [];
    list.push(r);
    byKey.set(key, list);
  }
  const groups: PantryGroup<T>[] = [];
  for (const key of PANTRY_ORDER) {
    const list = byKey.get(key);
    if (list && list.length) {
      groups.push({
        key,
        label: CATEGORY_LABELS[key],
        rows: [...list].sort((a, b) => a.name.localeCompare(b.name)),
      });
    }
  }
  return groups;
}
