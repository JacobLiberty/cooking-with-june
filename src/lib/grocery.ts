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

export type GrocerySections = {
  toGet: GroceryItem[];
  got: GroceryItem[];
  skipped: GroceryItem[];
};

/** Split the grocery list into mutually-exclusive sections. `checked` wins over
 *  `skipped` so an item that somehow lands in both still appears exactly once
 *  and never vanishes from every section. */
export function partitionGrocery(
  items: GroceryItem[],
  checked: Set<string>,
  skipped: Set<string>,
): GrocerySections {
  const sections: GrocerySections = { toGet: [], got: [], skipped: [] };
  for (const item of items) {
    if (checked.has(item.ingredientId)) sections.got.push(item);
    else if (skipped.has(item.ingredientId)) sections.skipped.push(item);
    else sections.toGet.push(item);
  }
  return sections;
}
