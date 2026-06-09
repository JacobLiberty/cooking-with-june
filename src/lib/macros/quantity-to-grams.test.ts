import { describe, it, expect } from "vitest";
import { quantityToGrams } from "@/lib/macros/quantity-to-grams";

function grams(r: ReturnType<typeof quantityToGrams>): number {
  if ("unparseable" in r) throw new Error("expected grams, got unparseable");
  return r.grams;
}

describe("quantityToGrams", () => {
  it("converts mass units exactly", () => {
    expect(grams(quantityToGrams("1", "lb", "ground beef"))).toBeCloseTo(453.6, 1);
    expect(grams(quantityToGrams("500", "g", "flour"))).toBe(500);
    expect(grams(quantityToGrams("2", "oz", "cheese"))).toBeCloseTo(56.7, 1);
  });

  it("normalizes unit aliases and plurals", () => {
    expect(grams(quantityToGrams("2", "pounds", "beef"))).toBeCloseTo(907.2, 1);
    expect(grams(quantityToGrams("3", "tablespoons", "soy sauce"))).toBeGreaterThan(0);
  });

  it("uses ingredient density for volume units", () => {
    // 1 cup water = 240 ml × 1 g/ml = 240 g
    expect(grams(quantityToGrams("1", "cup", "water"))).toBeCloseTo(240, 0);
    // 1 cup flour is much lighter than water (density ~0.53)
    expect(grams(quantityToGrams("1", "cup", "flour"))).toBeCloseTo(127.2, 1);
    // oil is denser than flour but lighter than water
    expect(grams(quantityToGrams("1", "cup", "olive oil"))).toBeCloseTo(220.8, 1);
  });

  it("takes the midpoint of a range", () => {
    // "2-3" cups water → 2.5 × 240 = 600
    expect(grams(quantityToGrams("2-3", "cup", "water"))).toBeCloseTo(600, 0);
  });

  it("uses average item weight for counts (by name or unit)", () => {
    expect(grams(quantityToGrams("2", "", "eggs"))).toBe(100);
    expect(grams(quantityToGrams("3", "cloves", "garlic"))).toBe(15);
    expect(grams(quantityToGrams("1", "", "onion"))).toBe(110);
  });

  it("flags lines with no numeric quantity as unparseable", () => {
    expect(quantityToGrams("a handful", "", "spinach")).toEqual({
      unparseable: true,
      reason: "no numeric quantity",
    });
    expect(quantityToGrams("to taste", "", "salt")).toMatchObject({
      unparseable: true,
    });
    expect(quantityToGrams("", "", "pepper")).toMatchObject({ unparseable: true });
  });

  it("flags unknown counts and unknown units as unparseable", () => {
    // a count with no known item weight
    expect(quantityToGrams("2", "", "mystery item")).toMatchObject({
      unparseable: true,
    });
    expect(quantityToGrams("1", "blorg", "stuff")).toMatchObject({
      unparseable: true,
    });
  });
});
