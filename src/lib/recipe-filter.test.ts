import { describe, it, expect } from "vitest";
import {
  matchesQuery,
  matchesIngredients,
  ingredientCoverage,
  MOST_THRESHOLD,
  matchesTags,
  matchesCollection,
  countByTag,
  countByIngredientId,
  applyRecipeFilters,
  type RecipeFilters,
} from "@/lib/recipe-filter";
import type { RecipeCardData } from "@/sanity/types";

function recipe(partial: Partial<RecipeCardData>): RecipeCardData {
  return {
    _id: "x",
    title: "Test",
    slug: "test",
    tags: [],
    ratingAvg: null,
    ratingApproved: false,
    toTry: false,
    madeCount: 0,
    ingredientIds: [],
    createdAt: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

const EMPTY: RecipeFilters = {
  query: "",
  ingredientIds: [],
  mode: "any",
  tags: [],
  collection: "all",
  sort: "name",
};

describe("matchesQuery", () => {
  it("matches case-insensitively on title and passes when empty", () => {
    const r = recipe({ title: "Weeknight Beef Ragù" });
    expect(matchesQuery(r, "")).toBe(true);
    expect(matchesQuery(r, "beef")).toBe(true);
    expect(matchesQuery(r, "BEEF")).toBe(true);
    expect(matchesQuery(r, "soup")).toBe(false);
  });
});

describe("ingredientCoverage", () => {
  it("returns the fraction of required ingredients you have on hand", () => {
    const r = recipe({ ingredientIds: ["beef", "onion", "garlic", "salt"] });
    expect(ingredientCoverage(r, ["beef"])).toBe(0.25);
    expect(ingredientCoverage(r, ["beef", "onion", "garlic"])).toBe(0.75);
    expect(ingredientCoverage(r, ["beef", "onion", "garlic", "salt"])).toBe(1);
    expect(ingredientCoverage(r, ["tofu"])).toBe(0);
  });
  it("measures against required ingredients only, ignoring optional ones", () => {
    // recipe needs beef + onion; garnish is optional (excluded from required)
    const r = recipe({
      ingredientIds: ["beef", "onion", "garnish"],
      requiredIngredientIds: ["beef", "onion"],
    });
    expect(ingredientCoverage(r, ["beef", "onion"])).toBe(1);
    expect(ingredientCoverage(r, ["beef"])).toBe(0.5);
  });
  it("returns null when the recipe lists no required ingredients", () => {
    expect(ingredientCoverage(recipe({ ingredientIds: null }), ["beef"])).toBeNull();
    expect(
      ingredientCoverage(
        recipe({ ingredientIds: ["garnish"], requiredIngredientIds: [] }),
        ["beef"],
      ),
    ).toBeNull();
  });
});

describe("matchesIngredients (coverage-based)", () => {
  const r = recipe({ ingredientIds: ["beef", "onion", "garlic", "salt"] });
  it("passes when nothing selected, in every mode", () => {
    expect(matchesIngredients(r, [], "any")).toBe(true);
    expect(matchesIngredients(r, [], "most")).toBe(true);
    expect(matchesIngredients(r, [], "all")).toBe(true);
  });
  it("ANY: matches when you have at least one of the recipe's ingredients", () => {
    expect(matchesIngredients(r, ["beef", "tofu"], "any")).toBe(true);
    expect(matchesIngredients(r, ["tofu"], "any")).toBe(false);
  });
  it("MOST: matches when you have at least the threshold share", () => {
    // 3/4 = 0.75 meets the 0.75 threshold; 2/4 = 0.5 does not
    expect(matchesIngredients(r, ["beef", "onion", "garlic"], "most")).toBe(true);
    expect(matchesIngredients(r, ["beef", "onion"], "most")).toBe(false);
  });
  it("ALL: matches only when you have every required ingredient", () => {
    expect(
      matchesIngredients(r, ["beef", "onion", "garlic", "salt"], "all"),
    ).toBe(true);
    expect(matchesIngredients(r, ["beef", "onion", "garlic"], "all")).toBe(false);
  });
  it("ignores optional ingredients for MOST and ALL", () => {
    const withOptional = recipe({
      ingredientIds: ["beef", "onion", "garnish"],
      requiredIngredientIds: ["beef", "onion"],
    });
    // having both required ingredients is a full match despite the missing garnish
    expect(matchesIngredients(withOptional, ["beef", "onion"], "all")).toBe(true);
  });
  it("uses a 0.75 threshold for 'most'", () => {
    expect(MOST_THRESHOLD).toBe(0.75);
  });
  it("treats a recipe with no required ingredients as no match when filtering", () => {
    const noIds = recipe({ ingredientIds: null });
    expect(matchesIngredients(noIds, [], "any")).toBe(true);
    expect(matchesIngredients(noIds, ["beef"], "any")).toBe(false);
    expect(matchesIngredients(noIds, ["beef"], "most")).toBe(false);
    expect(matchesIngredients(noIds, ["beef"], "all")).toBe(false);
  });
});

describe("matchesTags", () => {
  const r = recipe({ tags: ["Dinner", "Quick"] });
  it("passes when none selected; ANY-matches selected tags", () => {
    expect(matchesTags(r, [])).toBe(true);
    expect(matchesTags(r, ["Quick"])).toBe(true);
    expect(matchesTags(r, ["Dessert"])).toBe(false);
  });
});

describe("matchesCollection", () => {
  const approved = recipe({ ratingAvg: 4.75, ratingApproved: true });
  const toTry = recipe({ toTry: true });
  const made = recipe({ madeCount: 2 });
  const plain = recipe({ ratingAvg: 3, ratingApproved: false });

  it("passes everything for 'all'", () => {
    expect(matchesCollection(plain, "all")).toBe(true);
    expect(matchesCollection(toTry, "all")).toBe(true);
  });
  it("'totry' keeps only wishlisted recipes", () => {
    expect(matchesCollection(toTry, "totry")).toBe(true);
    expect(matchesCollection(plain, "totry")).toBe(false);
  });
  it("'made' keeps only recipes made at least once", () => {
    expect(matchesCollection(made, "made")).toBe(true);
    expect(matchesCollection(plain, "made")).toBe(false);
  });
  it("'approved' keeps only June-approved recipes", () => {
    expect(matchesCollection(approved, "approved")).toBe(true);
    expect(matchesCollection(plain, "approved")).toBe(false);
  });
});

describe("facet counts", () => {
  const recipes = [
    recipe({ tags: ["Dinner", "Quick"], ingredientIds: ["beef", "onion"] }),
    recipe({ tags: ["Dinner"], ingredientIds: ["onion"] }),
    recipe({ tags: [], ingredientIds: ["tofu"] }),
  ];
  it("counts recipes per tag", () => {
    expect(countByTag(recipes)).toEqual({ Dinner: 2, Quick: 1 });
  });
  it("counts recipes per ingredient id", () => {
    expect(countByIngredientId(recipes)).toEqual({ beef: 1, onion: 2, tofu: 1 });
  });
});

describe("applyRecipeFilters", () => {
  const a = recipe({ _id: "a", title: "Apple Cake", ratingAvg: 3, createdAt: "2026-01-03T00:00:00Z" });
  const b = recipe({ _id: "b", title: "Beef Stew", ratingAvg: 5, createdAt: "2026-01-01T00:00:00Z" });
  const c = recipe({ _id: "c", title: "Carrot Soup", ratingAvg: null, createdAt: "2026-01-02T00:00:00Z" });
  const all = [c, a, b];

  it("sorts by name (default, A→Z)", () => {
    expect(applyRecipeFilters(all, { ...EMPTY, sort: "name" }).map((r) => r._id)).toEqual(["a", "b", "c"]);
  });
  it("sorts by rating (high→low, unrated last)", () => {
    expect(applyRecipeFilters(all, { ...EMPTY, sort: "rating" }).map((r) => r._id)).toEqual(["b", "a", "c"]);
  });
  it("sorts by newest (createdAt desc)", () => {
    expect(applyRecipeFilters(all, { ...EMPTY, sort: "newest" }).map((r) => r._id)).toEqual(["a", "c", "b"]);
  });
  it("combines query + sort", () => {
    const out = applyRecipeFilters(all, { ...EMPTY, query: "e" }); // Apple cakE, BEef stew, carrot... "e": Apple Cake(e), Beef Stew(e) -> both; Carrot Soup no 'e'
    expect(out.map((r) => r._id)).toEqual(["a", "b"]);
  });
});
