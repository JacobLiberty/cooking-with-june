"use client";

import { useMemo, useState } from "react";
import type { IngredientOption, TagOption } from "@/sanity/types";
import type {
  RecipeFilters,
  SortKey,
  CookableFilter,
  CollectionKey,
} from "@/lib/recipe-filter";

const SORT_LABELS: Record<SortKey, string> = {
  name: "Name",
  rating: "Rating",
  newest: "Newest",
};

const COOKABLE_STEPS: { key: CookableFilter; label: string }[] = [
  { key: "off", label: "All" },
  { key: "now", label: "Cookable now" },
  { key: "1", label: "Missing ≤1" },
  { key: "2", label: "≤2" },
  { key: "3", label: "≤3" },
];

const COLLECTIONS: { key: CollectionKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "totry", label: "To try" },
  { key: "made", label: "Made it" },
  { key: "approved", label: "June approved" },
];

const TAG_LIMIT = 8;

export function FilterControls({
  filters,
  ingredients,
  tags,
  tagCounts = {},
  ingredientCounts = {},
  showCookable = false,
  onChange,
}: {
  filters: RecipeFilters;
  ingredients: IngredientOption[];
  tags: TagOption[];
  tagCounts?: Record<string, number>;
  ingredientCounts?: Record<string, number>;
  showCookable?: boolean;
  onChange: (next: RecipeFilters) => void;
}) {
  const [showAllTags, setShowAllTags] = useState(false);
  const [ingQuery, setIngQuery] = useState("");

  const toggle = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const nameById = useMemo(
    () => new Map(ingredients.map((i) => [i._id, i.name])),
    [ingredients],
  );

  const iq = ingQuery.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (!iq) return [];
    return ingredients
      .filter(
        (i) =>
          i.name.toLowerCase().includes(iq) &&
          !filters.ingredientIds.includes(i._id),
      )
      .slice(0, 6);
  }, [ingredients, iq, filters.ingredientIds]);

  const visibleTags = showAllTags
    ? tags
    : tags.filter((t, i) => i < TAG_LIMIT || filters.tags.includes(t.name));

  const addIngredient = (id: string) => {
    onChange({ ...filters, ingredientIds: toggle(filters.ingredientIds, id) });
    setIngQuery("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Collection">
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
        {showCookable ? (
          <>
            <span className="mx-1 h-5 w-px bg-ink/15" aria-hidden />
            <div
              role="group"
              aria-label="What can I cook?"
              className="inline-flex flex-wrap items-center gap-1 rounded-full border border-ink/20 p-0.5"
            >
              {COOKABLE_STEPS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={filters.cookable === s.key}
                  onClick={() => onChange({ ...filters, cookable: s.key })}
                  className={`kicker rounded-full px-3 py-1 transition-colors ${
                    filters.cookable === s.key
                      ? "bg-terracotta text-paper"
                      : "text-ink-soft hover:text-terracotta"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-6">
        <label className="min-w-0 flex-1">
          <span className="kicker block text-ink-soft">Search</span>
          <input
            type="search"
            value={filters.query}
            onChange={(e) => onChange({ ...filters, query: e.target.value })}
            placeholder="Search recipes…"
            className="mt-2.5 w-full max-w-sm border-b border-ink/25 bg-transparent pb-1 text-lg text-ink placeholder:text-ink-soft focus:border-terracotta"
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
        <div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby="tag-filter-label">
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
                {tagCounts[t.name] ? (
                  <span className="ml-1.5 tabular-nums">{tagCounts[t.name]}</span>
                ) : null}
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
          <label className="kicker block text-ink-soft" htmlFor="ingredient-filter">
            Has ingredients
          </label>
          {filters.ingredientIds.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {filters.ingredientIds.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => addIngredient(id)}
                    aria-label={`Remove ${nameById.get(id) ?? id} filter`}
                    className="kicker inline-flex items-center gap-1 rounded-full border border-clay bg-clay-wash px-2.5 py-1 text-ink hover:border-terracotta"
                  >
                    {nameById.get(id) ?? id}
                    <span aria-hidden>×</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <input
            id="ingredient-filter"
            type="search"
            value={ingQuery}
            onChange={(e) => setIngQuery(e.target.value)}
            placeholder="Add an ingredient…"
            aria-label="Filter by ingredient"
            className="w-full max-w-sm border-b border-ink/25 bg-transparent pb-1 text-ink placeholder:text-ink-soft focus:border-terracotta"
          />
          {iq ? (
            <ul className="flex flex-wrap gap-2">
              {suggestions.map((ing) => (
                <li key={ing._id}>
                  <button
                    type="button"
                    onClick={() => addIngredient(ing._id)}
                    className="kicker border border-ink/20 px-2.5 py-1 text-sm text-ink-soft hover:border-clay hover:text-ink"
                  >
                    {ing.name}
                    {ingredientCounts[ing._id] ? (
                      <span className="ml-1.5 tabular-nums">{ingredientCounts[ing._id]}</span>
                    ) : null}
                  </button>
                </li>
              ))}
              {suggestions.length === 0 ? (
                <li className="text-sm text-ink-soft">No matching ingredient.</li>
              ) : null}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
