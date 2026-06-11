import type { IngredientRequirement } from "@/lib/kitchen/types";

export type Coverage = { cookable: boolean; missingRequired: number };

/**
 * Coverage of ONE recipe against the pantry. Only required, non-nonfood
 * ingredients count; duplicate lines for the same ingredient are summed.
 * `cookable` is true only when there is at least one qualifying required
 * ingredient and the pantry covers all of them.
 */
export function recipeCoverage(
  requirements: IngredientRequirement[],
  pantry: Map<string, number>,
): Coverage {
  const required = new Map<string, number>();
  for (const r of requirements) {
    if (r.optional || r.category === "nonfood") continue;
    required.set(r.ingredientId, (required.get(r.ingredientId) ?? 0) + r.amount);
  }

  if (required.size === 0) return { cookable: false, missingRequired: 0 };

  let missingRequired = 0;
  for (const [ingredientId, amount] of required) {
    if ((pantry.get(ingredientId) ?? 0) < amount) missingRequired++;
  }
  return { cookable: missingRequired === 0, missingRequired };
}
