export type PlanIngredient = {
  ingredientId: string | null;
  name: string | null;
  quantity?: string;
  unit?: string;
};

export type GroceryItem = {
  ingredientId: string;
  name: string;
  amounts: string[];
};

function amountOf(line: PlanIngredient): string {
  return [line.quantity, line.unit].filter(Boolean).join(" ").trim();
}

/** Aggregate ingredient lines across planned recipes, deduped by ingredient id,
 *  collecting distinct amount strings. Sorted by name. */
export function buildGroceryList(
  recipes: PlanIngredient[][],
): GroceryItem[] {
  const byId = new Map<string, GroceryItem>();
  for (const lines of recipes) {
    for (const line of lines) {
      if (!line.ingredientId) continue;
      const existing = byId.get(line.ingredientId) ?? {
        ingredientId: line.ingredientId,
        name: line.name ?? line.ingredientId,
        amounts: [],
      };
      const amount = amountOf(line);
      if (amount && !existing.amounts.includes(amount)) {
        existing.amounts.push(amount);
      }
      byId.set(line.ingredientId, existing);
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}
