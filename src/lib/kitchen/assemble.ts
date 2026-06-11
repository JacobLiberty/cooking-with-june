import { lineToCanonical } from "@/lib/kitchen/convert";
import type { IngredientInfo, RecipeLine } from "@/lib/kitchen/types";
import {
  CANONICAL_UNIT_KINDS,
  INGREDIENT_CATEGORIES,
  type CanonicalUnitKind,
  type IngredientCategory,
} from "@/lib/enrichment/types";

/** A recipe ingredient line as returned by the requirement GROQ (Task 2). */
export type RawLine = {
  ingredientId: string;
  name: string;
  quantity?: string | null;
  unit?: string | null;
  optional?: boolean | null;
  canonicalUnitKind?: string | null;
  density?: number | null;
  avgUnitGrams?: number | null;
  category?: string | null;
  restockQuantity?: { quantity?: number; unit?: string } | null;
};

const isKind = (x: unknown): x is CanonicalUnitKind =>
  typeof x === "string" && (CANONICAL_UNIT_KINDS as readonly string[]).includes(x);
const isCategory = (x: unknown): x is IngredientCategory =>
  typeof x === "string" && (INGREDIENT_CATEGORIES as readonly string[]).includes(x);

/** Narrow a raw line's metadata to IngredientInfo, or null if un-enriched/invalid. */
export function toIngredientInfo(raw: RawLine): IngredientInfo | null {
  if (!isKind(raw.canonicalUnitKind) || !isCategory(raw.category)) return null;
  return {
    canonicalUnitKind: raw.canonicalUnitKind,
    density: typeof raw.density === "number" ? raw.density : undefined,
    avgUnitGrams: typeof raw.avgUnitGrams === "number" ? raw.avgUnitGrams : undefined,
    category: raw.category,
  };
}

export function toRecipeLines(raw: RawLine[]): RecipeLine[] {
  return raw.map((r) => ({
    ingredientId: r.ingredientId,
    name: r.name,
    quantity: r.quantity ?? null,
    unit: r.unit ?? null,
    optional: r.optional ?? false,
  }));
}

/** A metaFor lookup over raw lines; un-enriched ingredients resolve to undefined. */
export function buildMetaFor(
  raw: RawLine[],
): (ingredientId: string) => IngredientInfo | undefined {
  const map = new Map<string, IngredientInfo>();
  for (const r of raw) {
    const info = toIngredientInfo(r);
    if (info) map.set(r.ingredientId, info);
  }
  return (id) => map.get(id);
}

export function buildPantryMap(
  rows: { ingredientId: string; quantityG: number }[],
): Map<string, number> {
  return new Map(rows.map((r) => [r.ingredientId, r.quantityG]));
}

export function deltasToArray(
  deltas: Map<string, number>,
): { ingredientId: string; subtract: number }[] {
  return [...deltas].map(([ingredientId, subtract]) => ({ ingredientId, subtract }));
}

/** Convert a restock {quantity, unit} to the ingredient's canonical amount, or null. */
export function restockToCanonical(
  restock: { quantity?: number; unit?: string } | null | undefined,
  info: IngredientInfo,
  name: string,
): number | null {
  if (!restock || typeof restock.quantity !== "number") return null;
  const r = lineToCanonical(String(restock.quantity), restock.unit ?? "", info, name);
  return r.ok ? r.amount : null;
}
