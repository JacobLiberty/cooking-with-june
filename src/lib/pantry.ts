/**
 * Pure helpers for the Plan's grocery-list / pantry model.
 *
 * The Grocery List is an explicit set of ingredient ids (seeded when a recipe
 * is added). The Pantry is a separate, persistent set of ids you "have". An id
 * lives in at most one of the two.
 */

/** How many of a recipe's ingredients are NOT in the pantry (0 = have all). */
export function missingFromPantry(
  ingredientIds: string[],
  pantry: Set<string>,
): number {
  return ingredientIds.filter((id) => !pantry.has(id)).length;
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
