import { toIngredientInfo, restockToCanonical, type RawLine } from "@/lib/kitchen/assemble";
import type { CanonicalUnitKind } from "@/lib/enrichment/types";

export type PlanSeedRow = { recipeId: string; scale: number };
export type PantrySeedRow = {
  ingredientId: string;
  name: string;
  quantityG: number;
  canonicalUnitKind: CanonicalUnitKind;
};
export type SkippedIngredient = { ingredientId: string; name: string; reason: string };
export type ManualMatch = { name: string; ingredientId: string };

/** Pair each planned recipe id with its scale (default 1). */
export function planSeed(
  recipeIds: string[] | null | undefined,
  recipeScales: { recipeId: string; scale: number | null }[] | null | undefined,
): PlanSeedRow[] {
  const scaleById = new Map((recipeScales ?? []).map((s) => [s.recipeId, s.scale]));
  return (recipeIds ?? []).map((recipeId) => {
    const s = scaleById.get(recipeId);
    return { recipeId, scale: typeof s === "number" && s > 0 ? s : 1 };
  });
}

/**
 * Seed each pantry ingredient at its restock default, converted to canonical
 * units. Un-enriched ingredients and ones without a usable restock are reported
 * as `skipped` (for the review list), never silently dropped.
 */
export function pantrySeed(docs: RawLine[]): {
  seed: PantrySeedRow[];
  skipped: SkippedIngredient[];
} {
  const seed: PantrySeedRow[] = [];
  const skipped: SkippedIngredient[] = [];
  for (const doc of docs) {
    const info = toIngredientInfo(doc);
    if (!info) {
      skipped.push({ ingredientId: doc.ingredientId, name: doc.name, reason: "no stock metadata" });
      continue;
    }
    const grams = restockToCanonical(doc.restockQuantity, info, doc.name);
    if (grams == null || grams <= 0) {
      skipped.push({ ingredientId: doc.ingredientId, name: doc.name, reason: "no usable restock quantity" });
      continue;
    }
    seed.push({
      ingredientId: doc.ingredientId,
      name: doc.name,
      quantityG: grams,
      canonicalUnitKind: info.canonicalUnitKind,
    });
  }
  return { seed, skipped };
}

/** Match free-text manual items to the catalog by lowercased name. */
export function matchManualItems(
  items: { name: string }[],
  catalog: { ingredientId: string; name: string }[],
): { matched: ManualMatch[]; unmapped: string[] } {
  const byName = new Map(catalog.map((c) => [c.name.trim().toLowerCase(), c.ingredientId]));
  const matched: ManualMatch[] = [];
  const unmapped: string[] = [];
  for (const item of items) {
    const id = byName.get(item.name.trim().toLowerCase());
    if (id) matched.push({ name: item.name, ingredientId: id });
    else unmapped.push(item.name);
  }
  return { matched, unmapped };
}
