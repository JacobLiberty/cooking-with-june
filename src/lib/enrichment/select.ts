import type { IngredientDoc } from "@/lib/enrichment/types";

/** True when a catalog ingredient is missing any metadata depletion needs. */
export function ingredientNeedsEnrichment(doc: IngredientDoc): boolean {
  if (!doc.category) return true;
  const kind = doc.canonicalUnitKind;
  if (kind !== "mass" && kind !== "volume" && kind !== "count") return true;
  if (kind === "volume" && typeof doc.density !== "number") return true;
  if (kind === "count" && typeof doc.avgUnitGrams !== "number") return true;
  const r = doc.restockQuantity;
  if (!r || typeof r.quantity !== "number" || !r.unit) return true;
  return false;
}

/**
 * Filter a catalog to ingredients still missing stock metadata. `force: true`
 * bypasses the filter and returns every doc (re-enrich everything).
 */
export function selectIngredientsNeedingEnrichment(
  docs: IngredientDoc[],
  opts: { force?: boolean } = {},
): IngredientDoc[] {
  if (opts.force) return docs;
  return docs.filter(ingredientNeedsEnrichment);
}
