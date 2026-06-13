import { defineQuery } from "next-sanity";
import type { SanityImageSource } from "@sanity/image-url";
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

export type RecipeRequirementDoc = {
  _id: string;
  servings?: number | null;
  lines: RawLine[] | null;
};

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
    restockQuantity,
    density,
    avgUnitGrams
  }
`);

export type CatalogInfoDoc = {
  _id: string;
  name: string;
  canonicalUnitKind: "mass" | "volume" | "count" | null;
  category: string | null;
  restockQuantity: { quantity: number; unit: string } | null;
  density: number | null;
  avgUnitGrams: number | null;
};

/** Title + slug + cover + meta + optional-ingredient list for the Menu view. */
export const MENU_RECIPES_QUERY = defineQuery(`
  *[_type == "recipe" && _id in $ids]{
    _id,
    title,
    "slug": slug.current,
    "coverImage": images[0],
    prepTime,
    cookTime,
    servings,
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
  coverImage: SanityImageSource | null;
  prepTime: number | null;
  cookTime: number | null;
  servings: number | null;
  optionalIngredients: { id: string; name: string | null }[] | null;
};
