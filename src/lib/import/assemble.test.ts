import { describe, it, expect } from "vitest";
import { gramsOf, computeDraftMacros, buildDraft } from "@/lib/import/assemble";
import type { ImportResult, ImportedLine } from "@/lib/import/types";

const beef: ImportedLine = {
  name: "ground beef", quantity: "1", unit: "lb", optional: false,
  per100g: { calories: 215, protein: 18, carbs: 0, fat: 15 },
};
const herb: ImportedLine = {
  name: "cilantro", quantity: "10", unit: "g", optional: true,
  per100g: { calories: 23, protein: 2, carbs: 4, fat: 0 },
};
const pinch: ImportedLine = {
  name: "salt", quantity: "a pinch", optional: false,
  per100g: { calories: 0, protein: 0, carbs: 0, fat: 0 },
};

describe("gramsOf", () => {
  it("converts a parseable line to grams", () => {
    expect(gramsOf(beef)).toBeCloseTo(453.6, 1); // 1 lb
  });
  it("returns null when the amount can't be parsed", () => {
    expect(gramsOf(pinch)).toBeNull();
  });
});

describe("computeDraftMacros", () => {
  it("excludes optional from base, includes it in full, flags unparsed", () => {
    const m = computeDraftMacros([beef, herb, pinch], 2);
    expect(m.base.calories).toBeGreaterThan(0);
    expect(m.full.calories).toBeGreaterThan(m.base.calories); // herb (optional) adds to full
    expect(m.unparsedLines).toContain("salt");
    expect(m.estimated).toBe(true);
  });
});

describe("buildDraft", () => {
  it("attaches catalog matches and computes macros", () => {
    const result: ImportResult = {
      title: "Chili", description: "Hot.", servings: 2,
      candidateTags: ["dinner"], steps: ["Cook."], ingredients: [beef, herb],
    };
    const catalogByName = new Map([["ground beef", "beef-id"]]); // herb is new
    const draft = buildDraft(result, catalogByName);
    expect(draft.ingredients[0]).toMatchObject({ name: "ground beef", catalogId: "beef-id", isNew: false });
    expect(draft.ingredients[1]).toMatchObject({ name: "cilantro", catalogId: null, isNew: true });
    expect(draft.macros.full.calories).toBeGreaterThan(0);
    expect(draft.candidateTags).toEqual(["dinner"]);
  });
});
