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

export type ManualResolution = {
  sourceName: string;
  location: string;
  ingredientId: string | null;
  catalogName: string | null;
};

/** Lowercased candidate keys for matching, incl. simple plural strips. */
function nameCandidates(name: string): string[] {
  const n = name.trim().toLowerCase();
  const out = [n];
  if (n.endsWith("es")) out.push(n.slice(0, -2));
  if (n.endsWith("s")) out.push(n.slice(0, -1));
  return out;
}

/** Resolve free-text manual items to catalog ingredients (case-insensitive + simple plurals). */
export function resolveManualItems(
  items: { name: string; location?: string | null }[],
  catalog: { ingredientId: string; name: string }[],
): ManualResolution[] {
  const byName = new Map(catalog.map((c) => [c.name.trim().toLowerCase(), c]));
  return items.map((item) => {
    let match: { ingredientId: string; name: string } | undefined;
    for (const key of nameCandidates(item.name)) {
      match = byName.get(key);
      if (match) break;
    }
    return {
      sourceName: item.name,
      location: item.location ?? "grocery",
      ingredientId: match?.ingredientId ?? null,
      catalogName: match?.name ?? null,
    };
  });
}
