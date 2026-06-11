import type { CanonicalUnitKind, IngredientCategory } from "@/lib/enrichment/types";

/** The conversion-relevant subset of an ingredient's stock metadata. */
export type ConversionMeta = {
  canonicalUnitKind: CanonicalUnitKind;
  density?: number; // g/ml, meaningful for volume-kind
  avgUnitGrams?: number; // g/item, meaningful for count-kind
};

/** Conversion metadata plus the category (needed for the cookable filter). */
export type IngredientInfo = ConversionMeta & { category: IngredientCategory };

/** A recipe ingredient line, as much as the kitchen math needs. */
export type RecipeLine = {
  ingredientId: string;
  name: string;
  quantity?: string | null;
  unit?: string | null;
  optional?: boolean;
};

/** One ingredient's resolved, scaled requirement for a recipe, in canonical units. */
export type IngredientRequirement = {
  ingredientId: string;
  name: string;
  amount: number; // canonical unit (grams or count), already scaled
  optional: boolean;
  category: IngredientCategory;
};

/** A recipe line that could not be converted (missing amount, unknown unit, no metadata). */
export type UnparsedLine = {
  ingredientId: string;
  name: string;
  reason: string;
};

/** One computed grocery need (canonical amount still owed after pantry). */
export type GroceryNeed = {
  ingredientId: string;
  name: string;
  amount: number; // canonical unit, > 0
  optional: boolean; // true only when every planned use is optional
};

export type GramsResult = { grams: number } | { unparseable: true; reason: string };
