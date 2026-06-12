import type { RecipeMacros } from "@/lib/macros/sum";

/** Per-100g nutrients Claude returns per ingredient (required numbers). */
export type ImportNutrients = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

/** One ingredient line as Claude returns it. */
export type ImportedLine = {
  name: string;
  quantity?: string;
  unit?: string;
  note?: string;
  optional: boolean;
  per100g: ImportNutrients;
};

/** Claude's validated structured output for a recipe. */
export type ImportResult = {
  title: string;
  description: string;
  story?: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  candidateTags: string[];
  ingredients: ImportedLine[];
  steps: string[];
};

/** An ingredient line after catalog resolution (added by the server action). */
export type DraftLine = ImportedLine & {
  catalogId: string | null;
  isNew: boolean;
};

/** The display-ready draft returned to the review form. */
export type RecipeDraft = {
  title: string;
  description: string;
  story?: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  candidateTags: string[];
  ingredients: DraftLine[];
  steps: string[];
  macros: RecipeMacros;
};
