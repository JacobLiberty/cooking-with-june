import { describe, it, expect } from "vitest";
import { recipeRequirements } from "@/lib/kitchen/requirements";
import type { RecipeLine, IngredientInfo } from "@/lib/kitchen/types";

const INFO: Record<string, IngredientInfo> = {
  beef: { canonicalUnitKind: "mass", category: "protein" },
  egg: { canonicalUnitKind: "count", avgUnitGrams: 50, category: "produce" },
  foil: { canonicalUnitKind: "count", avgUnitGrams: 1, category: "nonfood" },
};
const metaFor = (id: string) => INFO[id];

const lines: RecipeLine[] = [
  { ingredientId: "beef", name: "ground beef", quantity: "1", unit: "lb" },
  { ingredientId: "egg", name: "egg", quantity: "2", unit: "", optional: true },
  { ingredientId: "mystery", name: "unobtainium", quantity: "1", unit: "g" },
];

describe("recipeRequirements", () => {
  it("converts and scales each line to canonical units", () => {
    const { requirements } = recipeRequirements(lines, 2, metaFor);
    const beef = requirements.find((r) => r.ingredientId === "beef")!;
    expect(beef.amount).toBeCloseTo(2 * 453.6);
    expect(beef.optional).toBe(false);
    expect(beef.category).toBe("protein");

    const egg = requirements.find((r) => r.ingredientId === "egg")!;
    expect(egg.amount).toBe(4);
    expect(egg.optional).toBe(true);
  });

  it("flags lines with no resolvable metadata as unparsed", () => {
    const { requirements, unparsed } = recipeRequirements(lines, 1, metaFor);
    expect(requirements.some((r) => r.ingredientId === "mystery")).toBe(false);
    expect(unparsed.map((u) => u.ingredientId)).toContain("mystery");
  });

  it("flags an unconvertible line (no quantity) as unparsed, not a requirement", () => {
    const { requirements, unparsed } = recipeRequirements(
      [{ ingredientId: "beef", name: "ground beef", quantity: "to taste", unit: "" }],
      1,
      metaFor,
    );
    expect(requirements).toHaveLength(0);
    expect(unparsed).toHaveLength(1);
  });

  it("scale defaults sensibly for non-positive scale", () => {
    const { requirements } = recipeRequirements(lines, 0, metaFor);
    const beef = requirements.find((r) => r.ingredientId === "beef")!;
    expect(beef.amount).toBeCloseTo(453.6);
  });
});
