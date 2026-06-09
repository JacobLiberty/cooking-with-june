/**
 * Pull the four macros (per 100 g) out of a USDA FoodData Central food record.
 * Tolerates both the search-result shape (`nutrientNumber` / `value`) and the
 * food-detail shape (`nutrient.number` / `amount`). Energy is taken in kcal.
 */

export type Per100g = {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

// USDA nutrient numbers are stable across datasets — match on number, not name.
const ENERGY = "208";
const PROTEIN = "203";
const FAT = "204";
const CARBS = "205";

type RawNutrient = {
  amount?: number;
  value?: number;
  unitName?: string;
  nutrientNumber?: string | number;
  nutrient?: { number?: string | number; unitName?: string };
};

type RawFood = { foodNutrients?: RawNutrient[] };

export function extractNutrients(food: RawFood | null | undefined): Per100g {
  const out: Per100g = {};
  for (const n of food?.foodNutrients ?? []) {
    const number = String(n?.nutrient?.number ?? n?.nutrientNumber ?? "");
    const unit = String(n?.nutrient?.unitName ?? n?.unitName ?? "").toUpperCase();
    const amount = n?.amount ?? n?.value;
    if (amount == null || Number.isNaN(Number(amount))) continue;
    const value = Number(amount);
    switch (number) {
      case ENERGY:
        // Energy can appear in both kcal and kJ; keep only kcal.
        if (unit === "KCAL" && out.calories == null) out.calories = value;
        break;
      case PROTEIN:
        out.protein = value;
        break;
      case FAT:
        out.fat = value;
        break;
      case CARBS:
        out.carbs = value;
        break;
    }
  }
  return out;
}
