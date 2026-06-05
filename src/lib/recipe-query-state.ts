import type {
  RecipeFilters,
  FilterMode,
  SortKey,
  CollectionKey,
} from "@/lib/recipe-filter";

const SORTS: SortKey[] = ["name", "rating", "newest"];
const MODES: FilterMode[] = ["any", "all"];
const COLLECTIONS: CollectionKey[] = ["all", "totry", "approved"];

function list(value: string | null): string[] {
  return value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

export function parseFilters(params: URLSearchParams): RecipeFilters {
  const mode = params.get("mode");
  const sort = params.get("sort");
  const col = params.get("col");
  return {
    query: params.get("q") ?? "",
    ingredientIds: list(params.get("ing")),
    mode: MODES.includes(mode as FilterMode) ? (mode as FilterMode) : "any",
    tags: list(params.get("tag")),
    collection: COLLECTIONS.includes(col as CollectionKey)
      ? (col as CollectionKey)
      : "all",
    sort: SORTS.includes(sort as SortKey) ? (sort as SortKey) : "name",
  };
}

export function serializeFilters(filters: RecipeFilters): string {
  const p = new URLSearchParams();
  if (filters.query.trim()) p.set("q", filters.query.trim());
  if (filters.ingredientIds.length) p.set("ing", filters.ingredientIds.join(","));
  if (filters.mode !== "any") p.set("mode", filters.mode);
  if (filters.tags.length) p.set("tag", filters.tags.join(","));
  if (filters.collection !== "all") p.set("col", filters.collection);
  if (filters.sort !== "name") p.set("sort", filters.sort);
  return p.toString();
}
