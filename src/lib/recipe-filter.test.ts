import { describe, it, expect } from "vitest";
import {
  matchesQuery,
  matchesIngredients,
  matchesCookable,
  matchesTags,
  matchesCollection,
  countByTag,
  countByIngredientId,
  applyRecipeFilters,
  type RecipeFilters,
  type CoverageMap,
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
  cookable: "off",
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

describe("matchesIngredients (AND-contains)", () => {
  it("passes when no ingredients are selected", () => {
    expect(matchesIngredients(recipe({ ingredientIds: ["a"] }), [])).toBe(true);
  });
  it("requires the recipe to contain every selected ingredient", () => {
    const r = recipe({ ingredientIds: ["a", "b", "c"] });
    expect(matchesIngredients(r, ["a", "b"])).toBe(true);
    expect(matchesIngredients(r, ["a", "z"])).toBe(false);
  });
});

describe("matchesCookable", () => {
  const cov: CoverageMap = {
    ready: { cookable: true, missingRequired: 0 },
    one: { cookable: false, missingRequired: 1 },
    three: { cookable: false, missingRequired: 3 },
  };
  it("passes everything when off", () => {
    expect(matchesCookable(recipe({ _id: "x" }), "off", cov)).toBe(true);
  });
  it("'now' keeps only fully-cookable recipes", () => {
    expect(matchesCookable(recipe({ _id: "ready" }), "now", cov)).toBe(true);
    expect(matchesCookable(recipe({ _id: "one" }), "now", cov)).toBe(false);
  });
  it("'2' keeps recipes missing two or fewer", () => {
    expect(matchesCookable(recipe({ _id: "one" }), "2", cov)).toBe(true);
    expect(matchesCookable(recipe({ _id: "three" }), "2", cov)).toBe(false);
  });
  it("excludes recipes with no coverage entry when active", () => {
    expect(matchesCookable(recipe({ _id: "missing" }), "now", cov)).toBe(false);
    expect(matchesCookable(recipe({ _id: "missing" }), "now", undefined)).toBe(false);
  });
});

describe("applyRecipeFilters with coverage", () => {
  it("applies the cookable filter against the coverage map", () => {
    const recipes = [
      recipe({ _id: "ready", title: "Ready" }),
      recipe({ _id: "one", title: "One short" }),
    ];
    const cov: CoverageMap = {
      ready: { cookable: true, missingRequired: 0 },
      one: { cookable: false, missingRequired: 1 },
    };
    const filters: RecipeFilters = {
      query: "", ingredientIds: [], cookable: "now", tags: [], collection: "all", sort: "name",
    };
    const out = applyRecipeFilters(recipes, filters, cov);
    expect(out.map((r) => r._id)).toEqual(["ready"]);
  });
});
