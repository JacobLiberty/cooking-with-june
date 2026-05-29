import type { RecipeFilters, FilterMode, SortKey } from "@/lib/recipe-filter";

const SORTS: SortKey[] = ["name", "rating", "newest"];
const MODES: FilterMode[] = ["any", "all"];

function list(value: string | null): string[] {
  return value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

export function parseFilters(params: URLSearchParams): RecipeFilters {
  const mode = params.get("mode");
  const sort = params.get("sort");
  return {
    query: params.get("q") ?? "",
    ingredientIds: list(params.get("ing")),
    mode: MODES.includes(mode as FilterMode) ? (mode as FilterMode) : "any",
    tags: list(params.get("tag")),
    sort: SORTS.includes(sort as SortKey) ? (sort as SortKey) : "name",
  };
}

export function serializeFilters(filters: RecipeFilters): string {
  const p = new URLSearchParams();
  if (filters.query.trim()) p.set("q", filters.query.trim());
  if (filters.ingredientIds.length) p.set("ing", filters.ingredientIds.join(","));
  if (filters.mode !== "any") p.set("mode", filters.mode);
  if (filters.tags.length) p.set("tag", filters.tags.join(","));
  if (filters.sort !== "name") p.set("sort", filters.sort);
  return p.toString();
}
