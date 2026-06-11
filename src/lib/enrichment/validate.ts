import type { StockMetadata, IngredientCategory } from "@/lib/enrichment/types";

const KINDS = ["mass", "volume", "count"] as const;
const CATEGORIES: IngredientCategory[] = [
  "produce", "protein", "dairy", "pantry", "spice", "other", "nonfood",
];

export type ValidationResult =
  | { ok: true; value: StockMetadata }
  | { ok: false; errors: string[] };

const isPosNumber = (x: unknown): x is number =>
  typeof x === "number" && Number.isFinite(x) && x > 0;

export function validateEnrichmentResult(raw: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, errors: ["result is not an object"] };
  }
  const r = raw as Record<string, unknown>;

  const kind = r.canonicalUnitKind;
  if (typeof kind !== "string" || !(KINDS as readonly string[]).includes(kind)) {
    errors.push("canonicalUnitKind must be mass|volume|count");
  }
  if (kind === "volume" && !isPosNumber(r.density)) {
    errors.push("volume-kind requires a positive density");
  }
  if (kind === "count" && !isPosNumber(r.avgUnitGrams)) {
    errors.push("count-kind requires a positive avgUnitGrams");
  }

  const restock = r.restockQuantity;
  const restockOk =
    typeof restock === "object" &&
    restock !== null &&
    isPosNumber((restock as Record<string, unknown>).quantity) &&
    typeof (restock as Record<string, unknown>).unit === "string";
  if (!restockOk) {
    errors.push("restockQuantity must have a positive quantity and a unit string");
  }

  const category = r.category;
  if (typeof category !== "string" || !CATEGORIES.includes(category as IngredientCategory)) {
    errors.push("category must be one of the known categories");
  }

  if (errors.length > 0) return { ok: false, errors };

  const validRestock = restock as { quantity: number; unit: string };
  return {
    ok: true,
    value: {
      canonicalUnitKind: kind as StockMetadata["canonicalUnitKind"],
      // Only carry the field meaningful for this kind; drop any cross-kind value
      // the model may have hallucinated so it never reaches Sanity.
      density: kind === "volume" ? (r.density as number) : undefined,
      avgUnitGrams: kind === "count" ? (r.avgUnitGrams as number) : undefined,
      restockQuantity: { quantity: validRestock.quantity, unit: validRestock.unit },
      category: category as IngredientCategory,
    },
  };
}
