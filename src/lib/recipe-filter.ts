import type { RecipeCardData } from "@/sanity/types";

export type SortKey = "name" | "rating" | "newest";
export type CollectionKey = "all" | "totry" | "made" | "approved";

/** Pantry-aware "what can I cook" filter: off, exactly cookable, or ≤N missing. */
export type CookableFilter = "off" | "now" | "1" | "2" | "3";

/** Per-recipe coverage from getCookableCoverage (base scale 1). */
export type CoverageMap = Record<string, { cookable: boolean; missingRequired: number }>;

const COOKABLE_MAX: Record<Exclude<CookableFilter, "off">, number> = {
  now: 0,
  "1": 1,
  "2": 2,
  "3": 3,
};

export type RecipeFilters = {
  query: string;
  ingredientIds: string[];
  cookable: CookableFilter;
  tags: string[];
  collection: CollectionKey;
  sort: SortKey;
};

/** How many recipes carry each tag (for facet counts). */
export function countByTag(recipes: RecipeCardData[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of recipes)
    for (const t of r.tags ?? []) counts[t] = (counts[t] ?? 0) + 1;
  return counts;
}

/** How many recipes use each ingredient id (for typeahead counts). */
export function countByIngredientId(
  recipes: RecipeCardData[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of recipes)
    for (const id of r.ingredientIds ?? []) counts[id] = (counts[id] ?? 0) + 1;
  return counts;
}

export function matchesCollection(
  recipe: RecipeCardData,
  collection: CollectionKey,
): boolean {
  if (collection === "totry") return recipe.toTry;
  if (collection === "made") return recipe.madeCount > 0;
  if (collection === "approved") return recipe.ratingApproved;
  return true;
}

export function matchesQuery(recipe: RecipeCardData, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return recipe.title.toLowerCase().includes(q);
}

/**
 * Ingredient filter: keep recipes that use EVERY selected ingredient (narrowing
 * "show me recipes with X and Y"). Matches against all of a recipe's ingredients
 * (optional included) since this is about the recipe's content, not the pantry.
 */
export function matchesIngredients(
  recipe: RecipeCardData,
  ingredientIds: string[],
): boolean {
  if (ingredientIds.length === 0) return true;
  const have = new Set(recipe.ingredientIds ?? []);
  return ingredientIds.every((id) => have.has(id));
}

export function matchesTags(recipe: RecipeCardData, tags: string[]): boolean {
  if (tags.length === 0) return true;
  const have = new Set(recipe.tags ?? []);
  return tags.some((t) => have.has(t));
}

/**
 * Pantry-aware cookability filter. "off" passes everything. Otherwise keep
 * recipes whose coverage exists and whose missing-required count is within the
 * threshold ("now" = 0 missing = fully cookable). Recipes with no coverage entry
 * (not computed, e.g. signed-out) are excluded when the filter is active.
 */
export function matchesCookable(
  recipe: RecipeCardData,
  cookable: CookableFilter,
  coverage: CoverageMap | undefined,
): boolean {
  if (cookable === "off") return true;
  const cov = coverage?.[recipe._id];
  if (!cov) return false;
  return cov.missingRequired <= COOKABLE_MAX[cookable];
}

function compare(a: RecipeCardData, b: RecipeCardData, sort: SortKey): number {
  if (sort === "name") return a.title.localeCompare(b.title);
  if (sort === "newest") return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  const ra = a.ratingAvg;
  const rb = b.ratingAvg;
  if (ra == null && rb == null) return a.title.localeCompare(b.title);
  if (ra == null) return 1;
  if (rb == null) return -1;
  return rb - ra || a.title.localeCompare(b.title);
}

export function applyRecipeFilters(
  recipes: RecipeCardData[],
  filters: RecipeFilters,
  coverage?: CoverageMap,
): RecipeCardData[] {
  return recipes
    .filter(
      (r) =>
        matchesQuery(r, filters.query) &&
        matchesIngredients(r, filters.ingredientIds) &&
        matchesTags(r, filters.tags) &&
        matchesCollection(r, filters.collection) &&
        matchesCookable(r, filters.cookable, coverage),
    )
    .sort((a, b) => compare(a, b, filters.sort));
}
