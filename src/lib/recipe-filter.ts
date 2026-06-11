import type { RecipeCardData } from "@/sanity/types";

export type SortKey = "name" | "rating" | "newest";
export type FilterMode = "any" | "most" | "all";
export type CollectionKey = "all" | "totry" | "approved";

/** "Most" matches recipes you have at least this share of the ingredients for. */
export const MOST_THRESHOLD = 0.75;

export type RecipeFilters = {
  query: string;
  ingredientIds: string[];
  mode: FilterMode;
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

/** How many recipes use each ingredient id (for facet counts). */
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
  if (collection === "totry") return Boolean(recipe.wishlist);
  if (collection === "approved") return recipe.ratingApproved;
  return true;
}

export function matchesQuery(recipe: RecipeCardData, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return recipe.title.toLowerCase().includes(q);
}

/** A recipe's ingredients that count toward pantry coverage (optional excluded). */
export function requiredIngredientIds(recipe: RecipeCardData): string[] {
  return recipe.requiredIngredientIds ?? recipe.ingredientIds ?? [];
}

/**
 * What share of a recipe's required ingredients you have on hand (0–1), or
 * null when the recipe lists no required ingredients (nothing to measure).
 */
export function ingredientCoverage(
  recipe: RecipeCardData,
  haveIds: string[],
): number | null {
  const required = requiredIngredientIds(recipe);
  if (required.length === 0) return null;
  const have = new Set(haveIds);
  const present = required.filter((id) => have.has(id)).length;
  return present / required.length;
}

/**
 * Pantry filter, by how much of the recipe you can already make:
 * - "any":  you have at least one of its ingredients
 * - "most": you have at least MOST_THRESHOLD of its required ingredients
 * - "all":  you have every required ingredient
 * Optional ingredients never count against "most"/"all".
 */
export function matchesIngredients(
  recipe: RecipeCardData,
  ingredientIds: string[],
  mode: FilterMode,
): boolean {
  if (ingredientIds.length === 0) return true;
  const coverage = ingredientCoverage(recipe, ingredientIds);
  if (coverage === null) return false;
  if (mode === "any") return coverage > 0;
  if (mode === "most") return coverage >= MOST_THRESHOLD;
  return coverage >= 1;
}

export function matchesTags(recipe: RecipeCardData, tags: string[]): boolean {
  if (tags.length === 0) return true;
  const have = new Set(recipe.tags ?? []);
  return tags.some((t) => have.has(t));
}

function compare(a: RecipeCardData, b: RecipeCardData, sort: SortKey): number {
  if (sort === "name") return a.title.localeCompare(b.title);
  if (sort === "newest") return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  // rating: high → low, unrated (null) last
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
): RecipeCardData[] {
  return recipes
    .filter(
      (r) =>
        matchesQuery(r, filters.query) &&
        matchesIngredients(r, filters.ingredientIds, filters.mode) &&
        matchesTags(r, filters.tags) &&
        matchesCollection(r, filters.collection),
    )
    .sort((a, b) => compare(a, b, filters.sort));
}
