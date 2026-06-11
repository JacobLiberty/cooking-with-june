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

  const restock = r.restockQuantity as Record<string, unknown> | undefined;
  if (!restock || !isPosNumber(restock.quantity) || typeof restock.unit !== "string") {
    errors.push("restockQuantity must have a positive quantity and a unit string");
  }

  const category = r.category;
  if (typeof category !== "string" || !(CATEGORIES as string[]).includes(category)) {
    errors.push("category must be one of the known categories");
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      canonicalUnitKind: kind as StockMetadata["canonicalUnitKind"],
      density: typeof r.density === "number" ? r.density : undefined,
      avgUnitGrams: typeof r.avgUnitGrams === "number" ? r.avgUnitGrams : undefined,
      restockQuantity: {
        quantity: (restock as { quantity: number }).quantity,
        unit: (restock as { unit: string }).unit,
      },
      category: category as IngredientCategory,
    },
  };
}
