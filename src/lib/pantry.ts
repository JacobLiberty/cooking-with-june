/**
 * Pure helpers for the Plan's grocery-list / pantry model.
 *
 * The Grocery List is an explicit set of ingredient ids (seeded when a recipe
 * is added). The Pantry is a separate, persistent set of ids you "have". An id
 * lives in at most one of the two.
 */

import { type FilterMode, MOST_THRESHOLD } from "@/lib/recipe-filter";

type WithIngredients = {
  ingredientIds: string[] | null;
  requiredIngredientIds?: string[] | null;
};

/** A recipe's ingredients that count toward coverage (optional ones excluded). */
function requiredIds(recipe: WithIngredients): string[] {
  return recipe.requiredIngredientIds ?? recipe.ingredientIds ?? [];
}

/** How many of a recipe's ingredients are NOT in the pantry (0 = have all). */
export function missingFromPantry(
  ingredientIds: string[],
  pantry: Set<string>,
): number {
  return ingredientIds.filter((id) => !pantry.has(id)).length;
}

/**
 * "Cook from pantry" results, ranked by how few ingredients you're missing.
 * Coverage is measured against a recipe's *required* ingredients only:
 * - mode "all":  you have every required ingredient.
 * - mode "most": you have at least MOST_THRESHOLD of them.
 * - mode "any":  you have at least one of them ("use what I have").
 * Recipes with no required ingredients are excluded in every mode.
 */
export function filterCookable<T extends WithIngredients>(
  recipes: T[],
  pantry: Set<string>,
  mode: FilterMode,
): T[] {
  return recipes
    .filter((r) => {
      const ids = requiredIds(r);
      if (ids.length === 0) return false;
      if (mode === "any") return ids.some((id) => pantry.has(id));
      const coverage =
        (ids.length - missingFromPantry(ids, pantry)) / ids.length;
      return mode === "all" ? coverage >= 1 : coverage >= MOST_THRESHOLD;
    })
    .sort(
      (a, b) =>
        missingFromPantry(requiredIds(a), pantry) -
        missingFromPantry(requiredIds(b), pantry),
    );
}

/**
 * Grocery ids after a recipe leaves the plan: drop the removed recipe's
 * ingredient ids, but keep any that another still-planned recipe also uses.
 * The pantry is intentionally untouched here.
 */
export function groceryAfterRecipeRemoval(
  grocery: string[],
  removedIngredientIds: Iterable<string>,
  remainingIngredientIds: Iterable<string>,
): string[] {
  const removed = new Set(removedIngredientIds);
  const keep = new Set(remainingIngredientIds);
  return grocery.filter((id) => !removed.has(id) || keep.has(id));
}

/**
 * Which ingredient ids to add to the grocery list when seeding from recipes:
 * any recipe ingredient not already on the grocery list or in the pantry
 * (de-duped).
 */
export function ingredientsToSeed(
  recipeIngredientIds: Iterable<string>,
  grocery: Set<string>,
  pantry: Set<string>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of recipeIngredientIds) {
    if (grocery.has(id) || pantry.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
