export type CanonicalUnitKind = "mass" | "volume" | "count";

export type RestockQuantity = { quantity: number; unit: string };

export type IngredientCategory =
  | "produce"
  | "protein"
  | "dairy"
  | "pantry"
  | "spice"
  | "other"
  | "nonfood";

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
