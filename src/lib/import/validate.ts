import type { ImportResult, ImportedLine, ImportNutrients } from "@/lib/import/types";

export type ImportValidation =
  | { ok: true; value: ImportResult }
  | { ok: false; errors: string[] };

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const str = (x: unknown): string => (typeof x === "string" ? x : "");
const optStr = (x: unknown): string | undefined =>
  typeof x === "string" && x.trim() ? x : undefined;
const optNum = (x: unknown): number | undefined => (isNum(x) ? x : undefined);

function nutrients(raw: unknown): ImportNutrients | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!isNum(r.calories) || !isNum(r.protein) || !isNum(r.carbs) || !isNum(r.fat)) return null;
  return { calories: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fat };
}

export function validateImportResult(raw: unknown): ImportValidation {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, errors: ["result is not an object"] };
  }
  const r = raw as Record<string, unknown>;

  const title = str(r.title).trim();
  if (!title) errors.push("title is required");
  const description = str(r.description).trim();

  const rawIngredients = Array.isArray(r.ingredients) ? r.ingredients : [];
  const ingredients: ImportedLine[] = [];
  for (const [i, rawLine] of rawIngredients.entries()) {
    if (typeof rawLine !== "object" || rawLine === null) { errors.push(`ingredient ${i} not an object`); continue; }
    const ing = rawLine as Record<string, unknown>;
    const name = str(ing.name).trim();
    const per100g = nutrients(ing.per100g);
    if (!name) { errors.push(`ingredient ${i} missing name`); continue; }
    if (!per100g) { errors.push(`ingredient ${i} (${name}) missing per100g`); continue; }
    ingredients.push({
      name,
      quantity: optStr(ing.quantity),
      unit: optStr(ing.unit),
      note: optStr(ing.note),
      optional: ing.optional === true,
      per100g,
    });
  }
  if (ingredients.length === 0) errors.push("at least one valid ingredient is required");

  const steps = Array.isArray(r.steps) ? r.steps.map(str).map((s) => s.trim()).filter(Boolean) : [];
  const candidateTags = Array.isArray(r.candidateTags)
    ? r.candidateTags.map(str).map((s) => s.trim().toLowerCase()).filter(Boolean)
    : [];

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      title,
      description,
      story: optStr(r.story),
      prepTime: optNum(r.prepTime),
      cookTime: optNum(r.cookTime),
      servings: optNum(r.servings),
      candidateTags,
      ingredients,
      steps,
    },
  };
}
