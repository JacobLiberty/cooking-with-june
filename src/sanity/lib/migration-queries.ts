import { defineQuery } from "next-sanity";
import type { RawLine } from "@/lib/kitchen/assemble";

/** The old global mealPlan: planned recipe ids + scales, pantry id-set, manual items. */
export const MIGRATION_SOURCE_QUERY = defineQuery(`
  *[_id == "mealPlan"][0]{
    "recipeIds": recipes[]._ref,
    "recipeScales": recipeScales[]{ "recipeId": _key, scale },
    pantryIngredients,
    "manualItems": manualItems[]{ name, location }
  }
`);

/** Stock metadata for a batch of ingredient ids (for pantry seeding). */
export const INGREDIENTS_BY_IDS_QUERY = defineQuery(`
  *[_type == "ingredient" && _id in $ids]{
    "ingredientId": _id,
    name,
    canonicalUnitKind,
    density,
    avgUnitGrams,
    category,
    restockQuantity
  }
`);

/** All catalog ingredient ids + names (for matching free-text manual items). */
export const INGREDIENT_NAMES_QUERY = defineQuery(`
  *[_type == "ingredient"]{ "ingredientId": _id, name }
`);

export type MigrationSource = {
  recipeIds: string[] | null;
  recipeScales: { recipeId: string; scale: number | null }[] | null;
  pantryIngredients: string[] | null;
  manualItems: { name: string; location?: string | null }[] | null;
};

export type IngredientMetaDoc = RawLine;
export type CatalogNameRow = { ingredientId: string; name: string };
