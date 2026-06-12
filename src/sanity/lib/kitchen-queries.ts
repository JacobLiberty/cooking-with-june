import { defineQuery } from "next-sanity";
import type { RawLine } from "@/lib/kitchen/assemble";

/**
 * Requirement data for a set of recipes: each recipe's ingredient lines with the
 * dereferenced ingredient name + stock metadata, ready for the Spec 2b lib.
 */
export const RECIPE_REQUIREMENTS_QUERY = defineQuery(`
  *[_type == "recipe" && _id in $ids]{
    _id,
    servings,
    "lines": ingredients[]{
      "ingredientId": ingredient._ref,
      "name": ingredient->name,
      quantity,
      unit,
      optional,
      "canonicalUnitKind": ingredient->canonicalUnitKind,
      "density": ingredient->density,
      "avgUnitGrams": ingredient->avgUnitGrams,
      "category": ingredient->category,
      "restockQuantity": ingredient->restockQuantity
    }
  }
`);

/** Restock metadata for a single ingredient (for the buy flow). */
export const INGREDIENT_RESTOCK_QUERY = defineQuery(`
  *[_type == "ingredient" && _id == $id][0]{
    _id,
    name,
    canonicalUnitKind,
    density,
    avgUnitGrams,
    category,
    restockQuantity
  }
`);

export type RecipeRequirementDoc = {
  _id: string;
  servings?: number | null;
  lines: RawLine[] | null;
};

export type IngredientRestockDoc = RawLine & { _id: string };

/**
 * Display + unit metadata for a set of catalog ingredients, keyed lookups for
 * pantry rows and manual grocery rows (which only carry an ingredientId).
 */
export const INGREDIENTS_BY_IDS_QUERY = defineQuery(`
  *[_type == "ingredient" && _id in $ids]{
    _id,
    name,
    canonicalUnitKind,
    category,
    restockQuantity
  }
`);

export type CatalogInfoDoc = {
  _id: string;
  name: string;
  canonicalUnitKind: "mass" | "volume" | "count" | null;
  category: string | null;
  restockQuantity: { quantity: number; unit: string } | null;
};

/** Title + slug + optional-ingredient list for the planned recipes (Menu view). */
export const MENU_RECIPES_QUERY = defineQuery(`
  *[_type == "recipe" && _id in $ids]{
    _id,
    title,
    "slug": slug.current,
    "optionalIngredients": ingredients[optional == true]{
      "id": ingredient._ref,
      "name": ingredient->name
    }
  }
`);

export type MenuRecipeDoc = {
  _id: string;
  title: string | null;
  slug: string | null;
  optionalIngredients: { id: string; name: string | null }[] | null;
};
