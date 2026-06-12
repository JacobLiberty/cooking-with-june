/**
 * System rules for the recipe-import call. Carries the normalization + macro
 * conventions from memory `recipe-import-process.md`, sent with cache_control so
 * repeat imports reuse the cached prefix.
 */
export function buildImportSystemRules(): string {
  return [
    "You normalize a pasted recipe blurb into a structured recipe. Use the import_recipe tool.",
    "",
    "STYLE: plain human prose. NO em dashes (—). Avoid AI tells (no 'just right', 'elevate', over-polished rule-of-three lists). Keep the cook's own voice for any story.",
    "",
    "INGREDIENTS: one entry per ingredient. Lowercase the name. Set optional=true for nice-to-have lines (notes like 'optional', 'to taste', 'to serve', 'for garnish', 'for serving'). Fill quantity + unit when given or reasonably inferable for the serving count; leave quantity blank rather than invent a wildly wrong number.",
    "",
    "NUTRIENTS: for each ingredient provide per100g macros (calories, protein, carbs, fat) for the ingredient IN THE STATE IT'S USED (raw meat on raw grams; pasta/oats/rice dry vs cooked as written). Account for consumed-vs-used context: fat strained off, salt in discarded boiling water, a marinade not fully eaten should reflect what's actually consumed. Do NOT compute recipe totals; just the per-100g values per line.",
    "",
    "STEPS: numbered method as a string array. TIMES: prepTime/cookTime in minutes; servings as a count. TAGS: candidateTags = short lowercase tag names that fit (e.g. 'dinner', 'vegetarian'); suggestions only.",
  ].join("\n");
}

export function buildImportUserPrompt(blurb: string): string {
  return `Normalize this recipe blurb into the import_recipe tool shape:\n\n${blurb}`;
}

const NUTRIENTS_SCHEMA = {
  type: "object" as const,
  properties: {
    calories: { type: "number" as const },
    protein: { type: "number" as const },
    carbs: { type: "number" as const },
    fat: { type: "number" as const },
  },
  required: ["calories", "protein", "carbs", "fat"],
};

export const IMPORT_TOOL = {
  name: "import_recipe",
  description: "Return the normalized recipe as structured fields.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: { type: "string" as const },
      description: { type: "string" as const },
      story: { type: "string" as const },
      prepTime: { type: "number" as const },
      cookTime: { type: "number" as const },
      servings: { type: "number" as const },
      candidateTags: { type: "array" as const, items: { type: "string" as const } },
      ingredients: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            name: { type: "string" as const },
            quantity: { type: "string" as const },
            unit: { type: "string" as const },
            note: { type: "string" as const },
            optional: { type: "boolean" as const },
            per100g: NUTRIENTS_SCHEMA,
          },
          required: ["name", "optional", "per100g"],
        },
      },
      steps: { type: "array" as const, items: { type: "string" as const } },
    },
    required: ["title", "description", "ingredients", "steps"],
  },
};
