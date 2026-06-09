import { describe, it, expect } from "vitest";
import { sumMacros, type MacroLine } from "@/lib/macros/sum";

const beef = { calories: 250, protein: 26, carbs: 0, fat: 15 }; // per 100g
const rice = { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 };

describe("sumMacros", () => {
  it("sums contributions scaled by grams/100 and divides by servings", () => {
    // 200g beef over 2 servings → per serving = (250×2)/2 = 250 cal, 26 protein
    const lines: MacroLine[] = [
      { label: "beef", optional: false, grams: 200, per100g: beef },
    ];
    const out = sumMacros(lines, 2);
    expect(out.base.calories).toBe(250);
    expect(out.base.protein).toBe(26);
    expect(out.base.fat).toBe(15);
  });

  it("computes base (required only) and full (incl optional) separately", () => {
    const lines: MacroLine[] = [
      { label: "beef", optional: false, grams: 100, per100g: beef },
      { label: "rice", optional: true, grams: 100, per100g: rice },
    ];
    const out = sumMacros(lines, 1);
    // base excludes the optional rice
    expect(out.base.calories).toBe(250);
    expect(out.base.carbs).toBe(0);
    // full includes it
    expect(out.full.calories).toBe(380);
    expect(out.full.carbs).toBe(28);
  });

  it("skips lines with no grams or no nutrition and lists them", () => {
    const lines: MacroLine[] = [
      { label: "beef", optional: false, grams: 100, per100g: beef },
      { label: "salt", optional: false, grams: null, per100g: beef },
      { label: "mystery", optional: false, grams: 100, per100g: null },
    ];
    const out = sumMacros(lines, 1);
    expect(out.base.calories).toBe(250);
    expect(out.unparsedLines).toEqual(["salt", "mystery"]);
  });

  it("guards zero/undefined servings (treats as 1)", () => {
    const lines: MacroLine[] = [
      { label: "beef", optional: false, grams: 100, per100g: beef },
    ];
    expect(sumMacros(lines, 0).base.calories).toBe(250);
    expect(sumMacros(lines, undefined).base.calories).toBe(250);
  });

  it("always marks results estimated", () => {
    expect(sumMacros([], 1).estimated).toBe(true);
  });
});
