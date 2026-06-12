import { describe, it, expect } from "vitest";
import { validateImportResult } from "@/lib/import/validate";

const ok = {
  title: "Chili",
  description: "A pot of chili.",
  servings: 4,
  candidateTags: ["dinner"],
  steps: ["Brown the beef.", "Simmer."],
  ingredients: [
    { name: "ground beef", quantity: "1", unit: "lb", optional: false,
      per100g: { calories: 215, protein: 18, carbs: 0, fat: 15 } },
    { name: "cilantro", optional: true,
      per100g: { calories: 23, protein: 2, carbs: 4, fat: 0 } },
  ],
};

describe("validateImportResult", () => {
  it("accepts a well-formed result and normalizes optional/arrays", () => {
    const res = validateImportResult(ok);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.title).toBe("Chili");
      expect(res.value.ingredients).toHaveLength(2);
      expect(res.value.ingredients[1].optional).toBe(true);
      expect(res.value.candidateTags).toEqual(["dinner"]);
    }
  });

  it("rejects missing title or empty ingredients", () => {
    expect(validateImportResult({ ...ok, title: "" }).ok).toBe(false);
    expect(validateImportResult({ ...ok, ingredients: [] }).ok).toBe(false);
  });

  it("rejects an ingredient missing per100g numbers", () => {
    const bad = { ...ok, ingredients: [{ name: "x", optional: false, per100g: { calories: 1 } }] };
    expect(validateImportResult(bad).ok).toBe(false);
  });

  it("rejects a non-object", () => {
    expect(validateImportResult(null).ok).toBe(false);
    expect(validateImportResult("nope").ok).toBe(false);
  });
});
