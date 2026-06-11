import { lineToCanonical } from "@/lib/kitchen/convert";
import type {
  RecipeLine,
  IngredientInfo,
  IngredientRequirement,
  UnparsedLine,
} from "@/lib/kitchen/types";

export type RequirementsResult = {
  requirements: IngredientRequirement[];
  unparsed: UnparsedLine[];
};

/**
 * Resolve a recipe's ingredient lines to scaled, canonical-unit requirements.
 * A line with no metadata or an unconvertible amount is reported in `unparsed`
 * rather than silently dropped. `scale <= 0` is treated as 1.
 */
export function recipeRequirements(
  lines: RecipeLine[],
  scale: number,
  metaFor: (ingredientId: string) => IngredientInfo | undefined,
): RequirementsResult {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const requirements: IngredientRequirement[] = [];
  const unparsed: UnparsedLine[] = [];

  for (const line of lines) {
    const info = metaFor(line.ingredientId);
    if (!info) {
      unparsed.push({
        ingredientId: line.ingredientId,
        name: line.name,
        reason: "no stock metadata",
      });
      continue;
    }
    const r = lineToCanonical(line.quantity, line.unit, info, line.name);
    if (!r.ok) {
      unparsed.push({ ingredientId: line.ingredientId, name: line.name, reason: r.reason });
      continue;
    }
    requirements.push({
      ingredientId: line.ingredientId,
      name: line.name,
      amount: r.amount * s,
      optional: line.optional ?? false,
      category: info.category,
    });
  }

  return { requirements, unparsed };
}
