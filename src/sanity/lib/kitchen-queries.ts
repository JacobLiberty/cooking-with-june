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
