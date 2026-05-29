import { describe, it, expect } from "vitest";
import {
  matchesQuery,
  matchesIngredients,
  matchesTags,
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
    ratings: [],
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

describe("matchesIngredients", () => {
  const r = recipe({ ingredientIds: ["beef", "onion", "garlic"] });
  it("passes when nothing selected", () => {
    expect(matchesIngredients(r, [], "any")).toBe(true);
    expect(matchesIngredients(r, [], "all")).toBe(true);
  });
  it("ANY: matches if at least one selected ingredient is present", () => {
    expect(matchesIngredients(r, ["beef", "tofu"], "any")).toBe(true);
    expect(matchesIngredients(r, ["tofu"], "any")).toBe(false);
  });
  it("ALL: matches only if every selected ingredient is present", () => {
    expect(matchesIngredients(r, ["beef", "onion"], "all")).toBe(true);
    expect(matchesIngredients(r, ["beef", "tofu"], "all")).toBe(false);
  });
  it("treats null ingredientIds as empty (no match when filtering)", () => {
    const noIds = recipe({ ingredientIds: null });
    expect(matchesIngredients(noIds, [], "any")).toBe(true);
    expect(matchesIngredients(noIds, ["beef"], "any")).toBe(false);
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

describe("applyRecipeFilters", () => {
  const a = recipe({ _id: "a", title: "Apple Cake", ratings: [{ editor: "J", value: 3 }], createdAt: "2026-01-03T00:00:00Z" });
  const b = recipe({ _id: "b", title: "Beef Stew", ratings: [{ editor: "J", value: 5 }], createdAt: "2026-01-01T00:00:00Z" });
  const c = recipe({ _id: "c", title: "Carrot Soup", ratings: [], createdAt: "2026-01-02T00:00:00Z" });
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
