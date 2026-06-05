import { describe, it, expect } from "vitest";
import {
  missingFromPantry,
  filterCookable,
  groceryAfterRecipeRemoval,
  ingredientsToSeed,
} from "@/lib/pantry";

describe("missingFromPantry", () => {
  it("counts ingredients not in the pantry", () => {
    expect(missingFromPantry(["a", "b", "c"], new Set(["a"]))).toBe(2);
    expect(missingFromPantry(["a", "b"], new Set(["a", "b"]))).toBe(0);
    expect(missingFromPantry([], new Set(["a"]))).toBe(0);
  });
});

describe("filterCookable", () => {
  const recipes = [
    { id: "have-all", ingredientIds: ["a", "b"] },
    { id: "missing-one", ingredientIds: ["a", "x"] },
    { id: "none", ingredientIds: ["x", "y"] },
    { id: "empty", ingredientIds: null },
  ];
  const pantry = new Set(["a", "b"]);

  it("'all' keeps only recipes you have every ingredient for", () => {
    expect(filterCookable(recipes, pantry, "all").map((r) => r.id)).toEqual([
      "have-all",
    ]);
  });

  it("'any' keeps recipes you have at least one ingredient for, ranked by fewest missing", () => {
    expect(filterCookable(recipes, pantry, "any").map((r) => r.id)).toEqual([
      "have-all", // missing 0
      "missing-one", // missing 1
    ]);
  });

  it("excludes recipes with no ingredient list", () => {
    expect(
      filterCookable(recipes, pantry, "any").some((r) => r.id === "empty"),
    ).toBe(false);
  });
});

describe("groceryAfterRecipeRemoval", () => {
  it("drops the removed recipe's ingredients", () => {
    expect(
      groceryAfterRecipeRemoval(["a", "b", "c"], ["a", "b"], []),
    ).toEqual(["c"]);
  });

  it("keeps ingredients another planned recipe still needs", () => {
    // removing a recipe with [a,b], but a remaining recipe also uses b
    expect(
      groceryAfterRecipeRemoval(["a", "b", "c"], ["a", "b"], ["b"]),
    ).toEqual(["b", "c"]);
  });

  it("leaves unrelated grocery items (manual seeds) alone", () => {
    expect(groceryAfterRecipeRemoval(["x", "y"], ["a"], [])).toEqual(["x", "y"]);
  });
});

describe("ingredientsToSeed", () => {
  it("adds recipe ingredients not already on grocery or in pantry", () => {
    expect(
      ingredientsToSeed(["a", "b", "c"], new Set(["a"]), new Set(["b"])),
    ).toEqual(["c"]);
  });

  it("de-dupes repeated ingredient ids", () => {
    expect(ingredientsToSeed(["a", "a", "b"], new Set(), new Set())).toEqual([
      "a",
      "b",
    ]);
  });

  it("adds nothing when everything is already tracked", () => {
    expect(
      ingredientsToSeed(["a", "b"], new Set(["a"]), new Set(["b"])),
    ).toEqual([]);
  });
});
