import { describe, it, expect } from "vitest";
import { extractNutrients } from "@/lib/macros/nutrients";

describe("extractNutrients", () => {
  it("reads the four macros by nutrient number from a detail-shaped record", () => {
    const food = {
      foodNutrients: [
        { nutrient: { number: "208", unitName: "KCAL" }, amount: 165 },
        { nutrient: { number: "203", unitName: "G" }, amount: 31 },
        { nutrient: { number: "204", unitName: "G" }, amount: 3.6 },
        { nutrient: { number: "205", unitName: "G" }, amount: 0 },
      ],
    };
    expect(extractNutrients(food)).toEqual({
      calories: 165,
      protein: 31,
      fat: 3.6,
      carbs: 0,
    });
  });

  it("prefers kcal energy and ignores a kJ energy entry", () => {
    const food = {
      foodNutrients: [
        { nutrient: { number: "208", unitName: "kJ" }, amount: 690 },
        { nutrient: { number: "208", unitName: "KCAL" }, amount: 165 },
      ],
    };
    expect(extractNutrients(food).calories).toBe(165);
  });

  it("tolerates the search-result shape (nutrientNumber / value)", () => {
    const food = {
      foodNutrients: [
        { nutrientNumber: "208", unitName: "KCAL", value: 52 },
        { nutrientNumber: "203", unitName: "G", value: 0.3 },
      ],
    };
    expect(extractNutrients(food)).toMatchObject({ calories: 52, protein: 0.3 });
  });

  it("returns an empty object for missing or empty input", () => {
    expect(extractNutrients(null)).toEqual({});
    expect(extractNutrients({ foodNutrients: [] })).toEqual({});
  });
});
