import type { IngredientRequirement } from "@/lib/kitchen/types";

export type Coverage = {
  cookable: boolean;
  missingRequired: number;
  missing: { ingredientId: string; name: string }[];
};

/**
 * Coverage of ONE recipe against the pantry. Only required, non-nonfood
 * ingredients count; duplicate lines for the same ingredient are summed.
 * `cookable` is true only when there is at least one qualifying required
 * ingredient and the pantry covers all of them. `missing` lists the shortfall
 * ingredients (id + name) for display.
 */
export function recipeCoverage(
  requirements: IngredientRequirement[],
  pantry: Map<string, number>,
): Coverage {
  const required = new Map<string, { amount: number; name: string }>();
  for (const r of requirements) {
    if (r.optional || r.category === "nonfood") continue;
    const cur = required.get(r.ingredientId);
    if (cur) cur.amount += r.amount;
    else required.set(r.ingredientId, { amount: r.amount, name: r.name });
  }

  if (required.size === 0) return { cookable: false, missingRequired: 0, missing: [] };

  const missing: { ingredientId: string; name: string }[] = [];
  for (const [ingredientId, { amount, name }] of required) {
    if ((pantry.get(ingredientId) ?? 0) < amount) missing.push({ ingredientId, name });
  }
  return { cookable: missing.length === 0, missingRequired: missing.length, missing };
}
