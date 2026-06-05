"use client";

import { useState } from "react";
import type { IngredientOption, TagOption } from "@/sanity/types";
import type {
  RecipeFilters,
  SortKey,
  FilterMode,
  CollectionKey,
} from "@/lib/recipe-filter";

const SORT_LABELS: Record<SortKey, string> = {
  name: "Name",
  rating: "Rating",
  newest: "Newest",
};

const COLLECTIONS: { key: CollectionKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "totry", label: "To try" },
  { key: "approved", label: "June approved" },
];

const TAG_LIMIT = 8;
const ING_LIMIT = 12;

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
  const [showAllTags, setShowAllTags] = useState(false);
  const [showAllIngredients, setShowAllIngredients] = useState(false);

  const toggle = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  // Collapsed view always keeps any *selected* chips visible so they stay
  // de-selectable, even past the limit.
  const visibleTags = showAllTags
    ? tags
    : tags.filter((t, i) => i < TAG_LIMIT || filters.tags.includes(t.name));
  const visibleIngredients = showAllIngredients
    ? ingredients
    : ingredients.filter(
        (ing, i) => i < ING_LIMIT || filters.ingredientIds.includes(ing._id),
      );

  return (
    <div className="space-y-6">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Collection"
      >
        {COLLECTIONS.map((c) => {
          const active = filters.collection === c.key;
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ ...filters, collection: c.key })}
              className={`kicker rounded-full border px-3.5 py-1.5 transition-colors ${
                active
                  ? "border-terracotta bg-terracotta text-paper"
                  : "border-ink/20 text-ink-soft hover:border-terracotta hover:text-terracotta"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-6">
        <label className="min-w-0 flex-1">
          <span className="kicker block text-ink-soft">Search</span>
          <input
            type="search"
            value={filters.query}
            onChange={(e) => onChange({ ...filters, query: e.target.value })}
            placeholder="Search recipes…"
            className="mt-2.5 w-full max-w-sm border-b border-ink/25 bg-transparent pb-1 text-lg text-ink placeholder:text-ink-soft/60 focus:border-terracotta"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="kicker text-ink-soft">Sort</span>
          <select
            value={filters.sort}
            onChange={(e) => onChange({ ...filters, sort: e.target.value as SortKey })}
            className="border-b border-ink/25 bg-transparent pb-1 text-ink focus:border-terracotta"
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
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-labelledby="tag-filter-label"
        >
          <span id="tag-filter-label" className="kicker text-ink-soft">
            Tags
          </span>
          {visibleTags.map((t) => {
            const active = filters.tags.includes(t.name);
            return (
              <button
                key={t._id}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ ...filters, tags: toggle(filters.tags, t.name) })}
                className={`kicker border px-2 py-1 ${active ? "border-terracotta bg-terracotta-wash text-terracotta" : "border-ink/20 text-ink-soft hover:border-terracotta"}`}
              >
                {t.name}
              </button>
            );
          })}
          {tags.length > TAG_LIMIT && (
            <button
              type="button"
              onClick={() => setShowAllTags((v) => !v)}
              aria-expanded={showAllTags}
              className="kicker px-2 py-1 text-terracotta hover:text-terracotta-deep"
            >
              {showAllTags ? "Show fewer" : `+${tags.length - TAG_LIMIT} more`}
            </button>
          )}
        </div>
      )}

      {ingredients.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span id="pantry-filter-label" className="kicker text-ink-soft">
              What&rsquo;s in your kitchen?
            </span>
            <div className="flex items-center gap-1" role="group" aria-label="Match mode">
              {(["any", "all"] as FilterMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={filters.mode === m}
                  onClick={() => onChange({ ...filters, mode: m })}
                  className={`kicker px-2 py-1 ${filters.mode === m ? "bg-ink text-paper" : "text-ink-soft hover:text-terracotta"}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-labelledby="pantry-filter-label"
          >
            {visibleIngredients.map((ing) => {
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
            {ingredients.length > ING_LIMIT && (
              <button
                type="button"
                onClick={() => setShowAllIngredients((v) => !v)}
                aria-expanded={showAllIngredients}
                className="kicker px-2 py-1 text-clay hover:text-clay/80"
              >
                {showAllIngredients
                  ? "Show fewer"
                  : `+${ingredients.length - ING_LIMIT} more`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
