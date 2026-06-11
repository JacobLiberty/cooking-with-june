import { describe, it, expect } from "vitest";
import { ingredientNeedsEnrichment, selectIngredientsNeedingEnrichment } from "@/lib/enrichment/select";
import type { IngredientDoc } from "@/lib/enrichment/types";

const complete: IngredientDoc = {
  _id: "a",
  name: "flour",
  category: "pantry",
  canonicalUnitKind: "volume",
  density: 0.53,
  restockQuantity: { quantity: 5, unit: "lb" },
};

describe("ingredientNeedsEnrichment", () => {
  it("false when all required metadata present", () => {
    expect(ingredientNeedsEnrichment(complete)).toBe(false);
  });

  it("true when canonicalUnitKind missing", () => {
    expect(ingredientNeedsEnrichment({ ...complete, canonicalUnitKind: undefined })).toBe(true);
  });

  it("true when restockQuantity incomplete", () => {
    expect(ingredientNeedsEnrichment({ ...complete, restockQuantity: { quantity: 5 } })).toBe(true);
  });

  it("true when restockQuantity is entirely missing", () => {
    expect(ingredientNeedsEnrichment({ ...complete, restockQuantity: undefined })).toBe(true);
  });

  it("true when restockQuantity is missing quantity", () => {
    expect(ingredientNeedsEnrichment({ ...complete, restockQuantity: { unit: "lb" } })).toBe(true);
  });

  it("true when category missing", () => {
    expect(ingredientNeedsEnrichment({ ...complete, category: undefined })).toBe(true);
  });

  it("count-kind needs avgUnitGrams, volume-kind needs density", () => {
    expect(
      ingredientNeedsEnrichment({ ...complete, canonicalUnitKind: "count", density: undefined, avgUnitGrams: undefined }),
    ).toBe(true);
    expect(
      ingredientNeedsEnrichment({ ...complete, canonicalUnitKind: "count", density: undefined, avgUnitGrams: 50 }),
    ).toBe(false);
    // mass-kind needs neither density nor avgUnitGrams
    expect(
      ingredientNeedsEnrichment({ ...complete, canonicalUnitKind: "mass", density: undefined, avgUnitGrams: undefined }),
    ).toBe(false);
  });

  it("false for a count item whose restock unit is an empty string (idempotent)", () => {
    expect(
      ingredientNeedsEnrichment({
        _id: "e",
        name: "egg",
        category: "produce",
        canonicalUnitKind: "count",
        avgUnitGrams: 50,
        restockQuantity: { quantity: 12, unit: "" },
      }),
    ).toBe(false);
  });
});

describe("selectIngredientsNeedingEnrichment", () => {
  const docs: IngredientDoc[] = [complete, { _id: "b", name: "egg" }];

  it("returns only docs missing metadata", () => {
    expect(selectIngredientsNeedingEnrichment(docs).map((d) => d._id)).toEqual(["b"]);
  });

  it("force=true returns all docs", () => {
    expect(selectIngredientsNeedingEnrichment(docs, { force: true }).map((d) => d._id)).toEqual(["a", "b"]);
  });
});
