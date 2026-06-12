type BlurbIngredient = {
  quantity?: string | null;
  unit?: string | null;
  name?: string | null;
  optional?: boolean | null;
};
type BlurbRecipe = {
  title: string;
  description?: string | null;
  story?: string | null;
  servings?: number | null;
  ingredients?: BlurbIngredient[] | null;
  steps?: string[] | null;
};

/** Render an existing recipe back into an editable plain-text blurb for re-import. */
export function recipeToBlurb(recipe: BlurbRecipe): string {
  const lines: string[] = [recipe.title];
  if (recipe.description) lines.push("", recipe.description);
  // Carry the story so re-import preserves it rather than silently clearing it.
  if (recipe.story) lines.push("", recipe.story);
  if (recipe.servings) lines.push("", `Serves ${recipe.servings}`);

  lines.push("", "Ingredients:");
  for (const ing of recipe.ingredients ?? []) {
    const amount = [ing.quantity, ing.unit, ing.name].filter(Boolean).join(" ").trim();
    if (!amount) continue;
    lines.push(`- ${amount}${ing.optional ? " (optional)" : ""}`);
  }

  lines.push("", "Steps:");
  (recipe.steps ?? []).forEach((s, i) => lines.push(`${i + 1}. ${s}`));

  return lines.join("\n");
}
