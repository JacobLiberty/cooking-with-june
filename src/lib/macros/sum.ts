import type { Per100g } from "@/lib/macros/nutrients";

export type MacroSet = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

/** One resolved ingredient line ready to contribute to a recipe's totals. */
export type MacroLine = {
  /** Human label (ingredient name) for reporting skipped lines. */
  label: string;
  /** Whether this line is an optional ingredient. */
  optional: boolean;
  /** Grams of this ingredient, or null when the amount couldn't be parsed. */
  grams: number | null;
  /** Per-100g nutrition, or null when there was no USDA match. */
  per100g: Per100g | null;
};

export type RecipeMacros = {
  /** Per serving, required ingredients only. */
  base: MacroSet;
  /** Per serving, including optional ingredients. */
  full: MacroSet;
  /** Always true: USDA-derived values are approximate. */
  estimated: boolean;
  /** Labels of lines we couldn't include (no amount or no USDA match). */
  unparsedLines: string[];
};

function zero(): MacroSet {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}

function addContribution(into: MacroSet, per100g: Per100g, grams: number): void {
  const f = grams / 100;
  into.calories += (per100g.calories ?? 0) * f;
  into.protein += (per100g.protein ?? 0) * f;
  into.carbs += (per100g.carbs ?? 0) * f;
  into.fat += (per100g.fat ?? 0) * f;
}

function perServing(total: MacroSet, servings: number): MacroSet {
  const s = servings > 0 ? servings : 1;
  return {
    calories: Math.round(total.calories / s),
    protein: Math.round((total.protein / s) * 10) / 10,
    carbs: Math.round((total.carbs / s) * 10) / 10,
    fat: Math.round((total.fat / s) * 10) / 10,
  };
}

/**
 * Sum ingredient contributions into per-serving macros, computing two figures:
 * `base` (required ingredients only) and `full` (including optional ones).
 * Lines with no parseable amount or no USDA match are skipped and listed in
 * `unparsedLines`.
 */
export function sumMacros(
  lines: MacroLine[],
  servings: number | null | undefined,
): RecipeMacros {
  const s = servings && servings > 0 ? servings : 1;
  const baseTotal = zero();
  const fullTotal = zero();
  const unparsedLines: string[] = [];

  for (const line of lines) {
    if (line.grams == null || line.per100g == null) {
      unparsedLines.push(line.label);
      continue;
    }
    addContribution(fullTotal, line.per100g, line.grams);
    if (!line.optional) addContribution(baseTotal, line.per100g, line.grams);
  }

  return {
    base: perServing(baseTotal, s),
    full: perServing(fullTotal, s),
    estimated: true,
    unparsedLines,
  };
}
