export const CANONICAL_UNIT_KINDS = ["mass", "volume", "count"] as const;
export type CanonicalUnitKind = (typeof CANONICAL_UNIT_KINDS)[number];

export type RestockQuantity = { quantity: number; unit: string };

// Keep in sync with the category options list in
// src/sanity/schemaTypes/documents/ingredient.ts
export const INGREDIENT_CATEGORIES = [
  "produce",
  "protein",
  "dairy",
  "pantry",
  "spice",
  "other",
  "nonfood",
] as const;
export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

/** The stock metadata Spec 2 depletion needs on every catalog ingredient. */
export type StockMetadata = {
  canonicalUnitKind: CanonicalUnitKind;
  density?: number; // volume-kind only
  avgUnitGrams?: number; // count-kind only
  restockQuantity: RestockQuantity;
  category: IngredientCategory;
};

/** A catalog ingredient doc as read from Sanity (only fields we touch here). */
export type IngredientDoc = {
  _id: string;
  name: string;
  category?: string;
  canonicalUnitKind?: string;
  density?: number;
  avgUnitGrams?: number;
  restockQuantity?: { quantity?: number; unit?: string };
};
