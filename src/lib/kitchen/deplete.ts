import type { IngredientRequirement } from "@/lib/kitchen/types";

/**
 * The canonical amount to subtract from the pantry per ingredient when a recipe
 * is cooked: all required amounts, plus optional amounts only for the ingredient
 * ids the cook confirms they used. Duplicate lines are summed. Clamping against
 * the actual pantry happens at apply time (Spec 2c).
 */
export function depletionDeltas(
  requirements: IngredientRequirement[],
  usedOptionalIds: Set<string>,
): Map<string, number> {
  const deltas = new Map<string, number>();
  for (const r of requirements) {
    if (r.optional && !usedOptionalIds.has(r.ingredientId)) continue;
    deltas.set(r.ingredientId, (deltas.get(r.ingredientId) ?? 0) + r.amount);
  }
  return deltas;
}
