import { describe, it, expect } from "vitest";
import {
  toIngredientInfo,
  toRecipeLines,
  buildMetaFor,
  buildPantryMap,
  deltasToArray,
  restockToCanonical,
  type RawLine,
} from "@/lib/kitchen/assemble";

const beefLine: RawLine = {
  ingredientId: "beef",
  name: "ground beef",
  quantity: "1",
  unit: "lb",
  optional: false,
  canonicalUnitKind: "mass",
  density: null,
  avgUnitGrams: null,
  category: "protein",
  restockQuantity: { quantity: 1, unit: "kg" },
};
const eggLine: RawLine = {
  ingredientId: "egg",
  name: "egg",
  quantity: "2",
  unit: "",
  optional: true,
  canonicalUnitKind: "count",
  density: null,
  avgUnitGrams: 50,
  category: "produce",
  restockQuantity: { quantity: 12, unit: "" },
};
const unenriched: RawLine = {
  ingredientId: "mystery",
  name: "unobtainium",
  quantity: "1",
  unit: "g",
  optional: false,
  canonicalUnitKind: null,
  density: null,
  avgUnitGrams: null,
  category: null,
  restockQuantity: null,
};

describe("toIngredientInfo", () => {
  it("narrows a valid raw line to IngredientInfo", () => {
    expect(toIngredientInfo(beefLine)).toEqual({
      canonicalUnitKind: "mass",
      density: undefined,
      avgUnitGrams: undefined,
      category: "protein",
    });
    expect(toIngredientInfo(eggLine)).toMatchObject({
      canonicalUnitKind: "count",
      avgUnitGrams: 50,
      category: "produce",
    });
  });

  it("returns null when metadata is missing/invalid (un-enriched)", () => {
    expect(toIngredientInfo(unenriched)).toBeNull();
  });

  it("returns null for an unknown category or kind", () => {
    expect(toIngredientInfo({ ...beefLine, category: "snacks" })).toBeNull();
    expect(toIngredientInfo({ ...beefLine, canonicalUnitKind: "blob" })).toBeNull();
  });
});

describe("toRecipeLines", () => {
  it("maps raw lines to RecipeLine shape", () => {
    expect(toRecipeLines([beefLine, eggLine])).toEqual([
      { ingredientId: "beef", name: "ground beef", quantity: "1", unit: "lb", optional: false },
      { ingredientId: "egg", name: "egg", quantity: "2", unit: "", optional: true },
    ]);
  });
});

describe("buildMetaFor", () => {
  it("returns a lookup that resolves enriched ingredients and skips un-enriched", () => {
    const metaFor = buildMetaFor([beefLine, eggLine, unenriched]);
    expect(metaFor("beef")?.category).toBe("protein");
    expect(metaFor("egg")?.avgUnitGrams).toBe(50);
    expect(metaFor("mystery")).toBeUndefined();
  });
});

describe("buildPantryMap", () => {
  it("maps pantry rows to ingredientId -> quantityG", () => {
    const m = buildPantryMap([
      { ingredientId: "beef", quantityG: 300 },
      { ingredientId: "egg", quantityG: 6 },
    ]);
    expect(m.get("beef")).toBe(300);
    expect(m.get("egg")).toBe(6);
  });
});

describe("deltasToArray", () => {
  it("converts a Map to the cook mutation's array shape", () => {
    const arr = deltasToArray(new Map([["beef", 200], ["egg", 2]]));
    expect(arr).toEqual(
      expect.arrayContaining([
        { ingredientId: "beef", subtract: 200 },
        { ingredientId: "egg", subtract: 2 },
      ]),
    );
    expect(arr).toHaveLength(2);
  });
});

describe("restockToCanonical", () => {
  it("converts a restock {quantity, unit} to a canonical amount", () => {
    const g = restockToCanonical({ quantity: 1, unit: "kg" }, toIngredientInfo(beefLine)!, "ground beef");
    expect(g).toBe(1000);
    const c = restockToCanonical({ quantity: 12, unit: "" }, toIngredientInfo(eggLine)!, "egg");
    expect(c).toBe(12);
  });

  it("returns null when the restock can't be converted", () => {
    expect(
      restockToCanonical({ quantity: 1, unit: "smidgen" }, toIngredientInfo(beefLine)!, "ground beef"),
    ).toBeNull();
  });
});
