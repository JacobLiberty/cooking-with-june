/** A single ingredient line carried on a planned recipe. */
export type PlanIngredient = {
  ingredientId: string | null;
  name: string | null;
  quantity?: string;
  unit?: string;
};
