import type { IngredientRequirement, GroceryNeed } from "@/lib/kitchen/types";

/**
 * Compute grocery needs from the flattened (already scaled) requirements of all
 * planned recipes, minus what the pantry holds. One need per ingredient whose
 * summed requirement exceeds the pantry. An ingredient is `optional` only when
 * EVERY planned use of it is optional.
 */
export function computeNeeds(
  requirements: IngredientRequirement[],
  pantry: Map<string, number>,
): GroceryNeed[] {
  const sum = new Map<
    string,
    { name: string; amount: number; allOptional: boolean }
  >();

  for (const r of requirements) {
    const cur = sum.get(r.ingredientId);
    if (cur) {
      cur.amount += r.amount;
      cur.allOptional = cur.allOptional && r.optional;
    } else {
      sum.set(r.ingredientId, {
        name: r.name,
        amount: r.amount,
        allOptional: r.optional,
      });
    }
  }

  const needs: GroceryNeed[] = [];
  for (const [ingredientId, { name, amount, allOptional }] of sum) {
    const need = amount - (pantry.get(ingredientId) ?? 0);
    if (need > 0) {
      needs.push({ ingredientId, name, amount: need, optional: allOptional });
    }
  }
  return needs;
}
