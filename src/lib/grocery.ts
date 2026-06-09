/** A single ingredient line carried on a planned recipe. */
export type PlanIngredient = {
  ingredientId: string | null;
  name: string | null;
  quantity?: string;
  unit?: string;
  optional?: boolean;
};

/** A planned recipe, reduced to what the grocery list needs. */
export type PlannedRecipe = {
  _id: string;
  ingredients: PlanIngredient[] | null;
};

/** How a grocery ingredient relates to the planned recipes that put it there. */
export type GroceryMeta = {
  /** How many distinct planned recipes use this ingredient. */
  recipeCount: number;
  /** True only when a single recipe uses it and marks it optional. */
  isOptional: boolean;
};

/**
 * For each ingredient id across the planned recipes, how many recipes use it
 * and whether it should read as "optional" on the grocery list.
 *
 * An item is optional only when exactly one recipe uses it and that recipe
 * marks it optional. As soon as two or more recipes need it, it's mandatory —
 * even if some of them list it as optional.
 */
export function groceryMetaByIngredient(
  recipes: PlannedRecipe[],
): Map<string, GroceryMeta> {
  const recipeIds = new Map<string, Set<string>>();
  // Whether every line seen so far for an id has been optional.
  const allOptional = new Map<string, boolean>();

  for (const recipe of recipes) {
    for (const line of recipe.ingredients ?? []) {
      const id = line.ingredientId;
      if (!id) continue;
      if (!recipeIds.has(id)) recipeIds.set(id, new Set());
      recipeIds.get(id)!.add(recipe._id);
      const stillOptional = allOptional.get(id) ?? true;
      allOptional.set(id, stillOptional && Boolean(line.optional));
    }
  }

  const out = new Map<string, GroceryMeta>();
  for (const [id, ids] of recipeIds) {
    const recipeCount = ids.size;
    out.set(id, {
      recipeCount,
      isOptional: recipeCount === 1 && (allOptional.get(id) ?? false),
    });
  }
  return out;
}
