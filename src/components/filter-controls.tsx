"use client";

import type { IngredientOption, TagOption } from "@/sanity/types";
import type { RecipeFilters, SortKey, FilterMode } from "@/lib/recipe-filter";

const SORT_LABELS: Record<SortKey, string> = {
  name: "Name",
  rating: "Rating",
  newest: "Newest",
};

export function FilterControls({
  filters,
  ingredients,
  tags,
  onChange,
}: {
  filters: RecipeFilters;
  ingredients: IngredientOption[];
  tags: TagOption[];
  onChange: (next: RecipeFilters) => void;
}) {
  const toggle = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <label className="flex-1">
          <span className="kicker text-ink-soft">Search</span>
          <input
            type="search"
            value={filters.query}
            onChange={(e) => onChange({ ...filters, query: e.target.value })}
            placeholder="Search recipes…"
            className="mt-1 w-full max-w-sm border-b border-ink/25 bg-transparent pb-1 text-lg text-ink outline-none placeholder:text-ink-soft/60 focus:border-heather"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="kicker text-ink-soft">Sort</span>
          <select
            value={filters.sort}
            onChange={(e) => onChange({ ...filters, sort: e.target.value as SortKey })}
            className="border-b border-ink/25 bg-transparent pb-1 text-ink outline-none focus:border-heather"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="kicker text-ink-soft">Tags</span>
          {tags.map((t) => {
            const active = filters.tags.includes(t.name);
            return (
              <button
                key={t._id}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ ...filters, tags: toggle(filters.tags, t.name) })}
                className={`kicker border px-2 py-1 ${active ? "border-heather bg-heather-wash text-heather" : "border-ink/20 text-ink-soft hover:border-heather"}`}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      )}

      {ingredients.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="kicker text-ink-soft">What&rsquo;s in your kitchen?</span>
            <div className="flex items-center gap-1" role="group" aria-label="Match mode">
              {(["any", "all"] as FilterMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={filters.mode === m}
                  onClick={() => onChange({ ...filters, mode: m })}
                  className={`kicker px-2 py-1 ${filters.mode === m ? "bg-ink text-paper" : "text-ink-soft hover:text-heather"}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {ingredients.map((ing) => {
              const active = filters.ingredientIds.includes(ing._id);
              return (
                <button
                  key={ing._id}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    onChange({ ...filters, ingredientIds: toggle(filters.ingredientIds, ing._id) })
                  }
                  className={`border px-2.5 py-1 text-sm ${active ? "border-clay bg-clay-wash text-clay" : "border-ink/20 text-ink-soft hover:border-clay"}`}
                >
                  {ing.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
