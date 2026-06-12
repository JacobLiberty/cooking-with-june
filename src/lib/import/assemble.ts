import { quantityToGrams } from "@/lib/macros/quantity-to-grams";
import { sumMacros, type MacroLine, type RecipeMacros } from "@/lib/macros/sum";
import type { ImportResult, ImportedLine, RecipeDraft, DraftLine } from "@/lib/import/types";

/** Grams for an imported line, or null when the amount can't be parsed. */
export function gramsOf(line: ImportedLine): number | null {
  const res = quantityToGrams(line.quantity, line.unit, line.name);
  return "grams" in res ? res.grams : null;
}

/**
 * Per-serving macros for a set of imported lines, computed deterministically
 * from each line's grams + per-100g nutrients. Reused live by the review form.
 */
export function computeDraftMacros(
  ingredients: ImportedLine[],
  servings: number | null | undefined,
): RecipeMacros {
  const lines: MacroLine[] = ingredients.map((i) => ({
    label: i.name,
    optional: i.optional,
    grams: gramsOf(i),
    per100g: i.per100g,
  }));
  return sumMacros(lines, servings);
}

/** Resolve catalog matches + compute macros into a display-ready draft. */
export function buildDraft(
  result: ImportResult,
  catalogByName: Map<string, string>,
): RecipeDraft {
  const ingredients: DraftLine[] = result.ingredients.map((i) => {
    const catalogId = catalogByName.get(i.name.toLowerCase()) ?? null;
    return { ...i, catalogId, isNew: catalogId === null };
  });
  return {
    title: result.title,
    description: result.description,
    story: result.story,
    prepTime: result.prepTime,
    cookTime: result.cookTime,
    servings: result.servings,
    candidateTags: result.candidateTags,
    ingredients,
    steps: result.steps,
    macros: computeDraftMacros(result.ingredients, result.servings),
  };
}
