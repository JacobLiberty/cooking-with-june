import type { RecipeCardData } from "@/sanity/types";
import { averageRating } from "@/lib/rating";
import { isJuneApproved } from "@/lib/june-approved";

export type SortKey = "name" | "rating" | "newest";
export type FilterMode = "any" | "all";
export type CollectionKey = "all" | "totry" | "approved";

export type RecipeFilters = {
  query: string;
  ingredientIds: string[];
  mode: FilterMode;
  tags: string[];
  collection: CollectionKey;
  sort: SortKey;
};

export function matchesCollection(
  recipe: RecipeCardData,
  collection: CollectionKey,
): boolean {
  if (collection === "totry") return Boolean(recipe.wishlist);
  if (collection === "approved") return isJuneApproved(recipe.ratings);
  return true;
}

export function matchesQuery(recipe: RecipeCardData, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return recipe.title.toLowerCase().includes(q);
}

export function matchesIngredients(
  recipe: RecipeCardData,
  ingredientIds: string[],
  mode: FilterMode,
): boolean {
  if (ingredientIds.length === 0) return true;
  const have = new Set(recipe.ingredientIds ?? []);
  return mode === "all"
    ? ingredientIds.every((id) => have.has(id))
    : ingredientIds.some((id) => have.has(id));
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
  const ra = averageRating(a.ratings);
  const rb = averageRating(b.ratings);
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
