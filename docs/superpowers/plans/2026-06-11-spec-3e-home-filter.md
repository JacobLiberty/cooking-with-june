# Spec 3e — Home Filter Rework + Final Cleanup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the home page's button-per-ingredient + any/most/all pantry filter with a quantity-aware design: typeahead ingredient search (recipes that use the picked ingredients) + collapsible tag facets (kept) + a pantry-aware **cookable stepper** (Cookable now / missing ≤1 / ≤2 / ≤3) wired to the Spec 2 `getCookableCoverage`. Then retire the dead `filterCookable`/old-mode code, fix the placeholder `revalidatePath` targets, and remove the one-time migration tool.

**Architecture:** The home server component already fetches all recipes; it additionally calls `getCookableCoverage(allRecipeIds)` once (members) and passes the `{cookable, missingRequired}` map into `CollectionView`, which filters instantly client-side. `recipe-filter.ts` swaps its pantry-coverage `mode` for a `cookable` filter that reads the coverage map; ingredient selection becomes a "recipe contains all selected ingredients" content filter. `filterCookable` (`src/lib/pantry.ts`) and the old `mode` machinery are deleted.

**Tech Stack:** Next.js 16 App Router, Tailwind, Vitest + Testing Library + user-event.

---

## Context the implementer needs

- `getCookableCoverage(recipeIds: string[])` (in `src/app/actions/kitchen-data.ts`) → `Record<recipeId, { cookable: boolean; missingRequired: number }>` at **base scale 1** ("can I make this as written?"). Member-gated.
- `RecipeCardData` (in `src/sanity/types.ts`): has `_id`, `ingredientIds: string[] | null`, `requiredIngredientIds?: string[] | null`, `tags: string[] | null`, `title`, `ratingAvg`, `ratingApproved`, `toTry`, `madeCount`, `createdAt`.
- Current home page (`src/app/(site)/page.tsx`) fetches `pantryIds` via `PLAN_PANTRY_QUERY` (Sanity `mealPlan`) and passes `pantryIds` to `CollectionView`. This is the LAST consumer of the old Sanity-mealPlan pantry; after this spec it's gone.
- After this spec, `src/lib/pantry.ts` (`filterCookable`/`missingFromPantry`/`groceryAfterRecipeRemoval`/`ingredientsToSeed`) has NO remaining importers (its only live user, `collection-view.tsx`, is reworked in Task 4) → delete it + its test.
- `src/sanity/lib/plan-queries.ts` (`PLAN_QUERY`, `PLAN_PANTRY_QUERY`, `PLAN_RECIPE_IDS_QUERY`) becomes fully dead after Task 4 (home stops using `PLAN_PANTRY_QUERY`; the other two were orphaned in 3d) → delete it.
- The migration tool: `src/app/(site)/admin/migrate/page.tsx` + `src/components/migrate-runner.tsx` — already RUN by the owner, confirmed not needed → delete. KEEP the pure/tested logic (`src/lib/kitchen/migrate.ts`, `src/app/actions/migrate-actions.ts`, `src/sanity/lib/migration-queries.ts`) — harmless, owner-gated, reusable.
- `revalidate()` in `src/app/actions/kitchen-actions.ts` currently does `revalidatePath("/plan")` + `revalidatePath("/", "layout")`. Fix to the real routes.

---

## File Structure

**Modify:**
- `src/lib/recipe-filter.ts` (+ `.test.ts`) — `mode`→`cookable`; AND-contains ingredient match; `matchesCookable`; `applyRecipeFilters(recipes, filters, coverage?)`.
- `src/lib/recipe-query-state.ts` (+ `.test.ts`) — `mode`→`cookable` URL param.
- `src/components/filter-controls.tsx` (+ `.test.tsx`) — ingredient typeahead + chips + cookable stepper (replace ingredient grid + mode toggle); keep collection/search/sort/tags.
- `src/components/collection-view.tsx` — accept `coverage` map; drop `pantryOnly`/`filterCookable`.
- `src/app/(site)/page.tsx` — `getCookableCoverage` instead of `PLAN_PANTRY_QUERY`.
- `src/app/actions/kitchen-actions.ts` — fix `revalidate()` targets.

**Delete:**
- `src/lib/pantry.ts`, `src/lib/pantry.test.ts`
- `src/sanity/lib/plan-queries.ts`
- `src/app/(site)/admin/migrate/page.tsx`, `src/components/migrate-runner.tsx`

---

## Task 1: Rework `recipe-filter.ts`

**Files:** Modify `src/lib/recipe-filter.ts`, `src/lib/recipe-filter.test.ts`.

- [ ] **Step 1: Rewrite the module.** Replace the entire contents of `src/lib/recipe-filter.ts` with:

```ts
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
```

- [ ] **Step 2: Update the tests.** Open `src/lib/recipe-filter.test.ts`. Remove every test referencing `mode`, `matchesIngredients(recipe, ids, mode)`, `ingredientCoverage`, `requiredIngredientIds`, `MOST_THRESHOLD`, or `filterCookable`. Keep/adjust the `countByTag`/`countByIngredientId`/`matchesQuery`/`matchesTags`/`matchesCollection`/sort tests. Add these:

```ts
import {
  matchesIngredients,
  matchesCookable,
  applyRecipeFilters,
  type RecipeFilters,
  type CoverageMap,
} from "@/lib/recipe-filter";

const recipe = (over: Partial<import("@/sanity/types").RecipeCardData> = {}) =>
  ({
    _id: "r1",
    title: "Test",
    slug: "test",
    tags: [],
    ingredientIds: [],
    requiredIngredientIds: [],
    createdAt: "2026-01-01",
    ratingAvg: null,
    ratingApproved: false,
    toTry: false,
    madeCount: 0,
    ...over,
  }) as import("@/sanity/types").RecipeCardData;

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
```

- [ ] **Step 3: Run + verify.** Run: `npx vitest run src/lib/recipe-filter.test.ts` → PASS. Run `npx tsc --noEmit` — it WILL still error in `recipe-query-state.ts`/`filter-controls.tsx`/`collection-view.tsx`/`pantry.ts` (they reference the removed `mode`/`FilterMode`); those are fixed in Tasks 2-5. Confirm the ERRORS ARE ONLY in those four files. If recipe-filter.test.ts passes and the only tsc errors are in those downstream files, proceed.

- [ ] **Step 4: Commit**

```bash
git add src/lib/recipe-filter.ts src/lib/recipe-filter.test.ts
git commit -m "feat(3e): recipe-filter cookable map + AND-contains ingredients (drops any/most/all mode)"
```

---

## Task 2: Rework `recipe-query-state.ts`

**Files:** Modify `src/lib/recipe-query-state.ts`, `src/lib/recipe-query-state.test.ts`.

- [ ] **Step 1: Rewrite the module.** Replace `src/lib/recipe-query-state.ts` with:

```ts
import type {
  RecipeFilters,
  CookableFilter,
  SortKey,
  CollectionKey,
} from "@/lib/recipe-filter";

const SORTS: SortKey[] = ["name", "rating", "newest"];
const COOKABLES: CookableFilter[] = ["off", "now", "1", "2", "3"];
const COLLECTIONS: CollectionKey[] = ["all", "totry", "made", "approved"];

function list(value: string | null): string[] {
  return value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

export function parseFilters(params: URLSearchParams): RecipeFilters {
  const cookable = params.get("cook");
  const sort = params.get("sort");
  const col = params.get("col");
  return {
    query: params.get("q") ?? "",
    ingredientIds: list(params.get("ing")),
    cookable: COOKABLES.includes(cookable as CookableFilter)
      ? (cookable as CookableFilter)
      : "off",
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
  if (filters.cookable !== "off") p.set("cook", filters.cookable);
  if (filters.tags.length) p.set("tag", filters.tags.join(","));
  if (filters.collection !== "all") p.set("col", filters.collection);
  if (filters.sort !== "name") p.set("sort", filters.sort);
  return p.toString();
}
```

- [ ] **Step 2: Update the tests.** In `src/lib/recipe-query-state.test.ts`, replace any `mode` assertions with `cookable` ones. Ensure coverage of: default `cookable` is `"off"`; `cook=now`/`cook=2` round-trip; an invalid `cook` value falls back to `"off"`; `cookable: "off"` omits the `cook` param. Example additions:

```ts
it("round-trips the cookable filter", () => {
  const f = parseFilters(new URLSearchParams("cook=2"));
  expect(f.cookable).toBe("2");
  expect(serializeFilters(f)).toContain("cook=2");
});
it("defaults cookable to off and omits it when off", () => {
  const f = parseFilters(new URLSearchParams(""));
  expect(f.cookable).toBe("off");
  expect(serializeFilters({ ...f })).not.toContain("cook");
});
it("falls back to off for an unknown cookable value", () => {
  expect(parseFilters(new URLSearchParams("cook=bogus")).cookable).toBe("off");
});
```

- [ ] **Step 3: Run + commit.** Run: `npx vitest run src/lib/recipe-query-state.test.ts` → PASS.

```bash
git add src/lib/recipe-query-state.ts src/lib/recipe-query-state.test.ts
git commit -m "feat(3e): URL state uses cook= cookable filter (drops mode=)"
```

---

## Task 3: Rework `filter-controls.tsx`

**Files:** Modify `src/components/filter-controls.tsx`, `src/components/filter-controls.test.tsx`.

- [ ] **Step 1: Rewrite the component.** Replace the entire contents of `src/components/filter-controls.tsx` with:

```tsx
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

      {showCookable ? (
        <div role="group" aria-label="Cookable filter" className="space-y-2">
          <span className="kicker text-ink-soft">What can I cook?</span>
          <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-ink/20 p-0.5">
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
        </div>
      ) : null}

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
```

- [ ] **Step 2: Rewrite the test.** Replace `src/components/filter-controls.test.tsx` with tests for the new behavior. Cover: collection toggle, search, sort, tag toggle, the **cookable stepper** (hidden when `showCookable` is false; shown + togglable when true), the **ingredient typeahead** (typing shows suggestions; clicking a suggestion adds it to `ingredientIds`; an active chip removes it). Use this:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterControls } from "@/components/filter-controls";
import type { RecipeFilters } from "@/lib/recipe-filter";

const base: RecipeFilters = {
  query: "", ingredientIds: [], cookable: "off", tags: [], collection: "all", sort: "name",
};
const ingredients = [
  { _id: "beef", name: "beef" },
  { _id: "rice", name: "rice" },
];
const tags = [{ _id: "t1", name: "dinner" }];

const setup = (filters: RecipeFilters = base, showCookable = false) => {
  const onChange = vi.fn();
  render(
    <FilterControls
      filters={filters}
      ingredients={ingredients}
      tags={tags}
      showCookable={showCookable}
      onChange={onChange}
    />,
  );
  return onChange;
};

describe("FilterControls", () => {
  it("hides the cookable stepper unless showCookable is set", () => {
    setup(base, false);
    expect(screen.queryByRole("group", { name: "Cookable filter" })).not.toBeInTheDocument();
  });

  it("shows the cookable stepper and reports the chosen step", async () => {
    const user = userEvent.setup();
    const onChange = setup(base, true);
    await user.click(screen.getByRole("button", { name: "Cookable now" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ cookable: "now" }));
  });

  it("adds an ingredient from the typeahead", async () => {
    const user = userEvent.setup();
    const onChange = setup();
    await user.type(screen.getByLabelText("Filter by ingredient"), "bee");
    await user.click(screen.getByRole("button", { name: /beef/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ ingredientIds: ["beef"] }));
  });

  it("removes an active ingredient chip", async () => {
    const user = userEvent.setup();
    const onChange = setup({ ...base, ingredientIds: ["beef"] });
    await user.click(screen.getByRole("button", { name: "Remove beef filter" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ ingredientIds: [] }));
  });

  it("toggles a tag", async () => {
    const user = userEvent.setup();
    const onChange = setup();
    await user.click(screen.getByRole("button", { name: /dinner/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ tags: ["dinner"] }));
  });
});
```

- [ ] **Step 3: Run.** Run: `npx vitest run src/components/filter-controls.test.tsx` → PASS. (`tsc` still errors in `collection-view.tsx` until Task 4 — that's expected.) Commit:

```bash
git add src/components/filter-controls.tsx src/components/filter-controls.test.tsx
git commit -m "feat(3e): FilterControls typeahead + cookable stepper (replaces ingredient grid + mode toggle)"
```

---

## Task 4: Rework `collection-view.tsx` + wire the home page

**Files:** Modify `src/components/collection-view.tsx`, `src/app/(site)/page.tsx`.

- [ ] **Step 1: Rewrite `collection-view.tsx`.** Replace its entire contents with:

```tsx
"use client";

import { useCallback, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type {
  RecipeCardData,
  IngredientOption,
  TagOption,
} from "@/sanity/types";
import {
  applyRecipeFilters,
  countByTag,
  countByIngredientId,
  type RecipeFilters,
  type CoverageMap,
} from "@/lib/recipe-filter";
import { parseFilters, serializeFilters } from "@/lib/recipe-query-state";
import { FilterControls } from "@/components/filter-controls";
import { RecipeGrid } from "@/components/recipe-grid";
import { JuneArt } from "@/components/june";

export function CollectionView({
  recipes,
  ingredients,
  tags,
  coverage,
}: {
  recipes: RecipeCardData[];
  ingredients: IngredientOption[];
  tags: TagOption[];
  coverage?: CoverageMap;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => parseFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const tagCounts = useMemo(() => countByTag(recipes), [recipes]);
  const ingredientCounts = useMemo(() => countByIngredientId(recipes), [recipes]);

  const setFilters = useCallback(
    (next: RecipeFilters) => {
      const qs = serializeFilters(next);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const filtered = useMemo(
    () => applyRecipeFilters(recipes, filters, coverage),
    [recipes, filters, coverage],
  );

  const surprise = useCallback(() => {
    if (filtered.length === 0) return;
    const pick = filtered[Math.floor(Math.random() * filtered.length)];
    router.push(`/recipe/${pick.slug}`);
  }, [filtered, router]);

  return (
    <div className="space-y-8">
      <FilterControls
        filters={filters}
        ingredients={ingredients}
        tags={tags}
        tagCounts={tagCounts}
        ingredientCounts={ingredientCounts}
        showCookable={Boolean(coverage)}
        onChange={setFilters}
      />

      <div className="flex items-center justify-between border-t border-terracotta/25 pt-4">
        <span className="kicker text-ink-soft" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "recipe" : "recipes"}
        </span>
        <button
          type="button"
          onClick={surprise}
          disabled={filtered.length === 0}
          className="kicker text-terracotta hover:text-terracotta-deep disabled:opacity-40"
        >
          Surprise me
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <JuneArt pose="sleeping" className="h-28 w-auto opacity-90" />
          {recipes.length === 0 ? (
            <>
              <p className="editorial-display text-2xl text-ink">No recipes yet</p>
              <p className="text-ink-soft">
                June&rsquo;s kitchen is empty for now. Add the first recipe and
                it&rsquo;ll show up here.
              </p>
            </>
          ) : (
            <>
              <p className="editorial-display text-2xl text-ink">Nothing here</p>
              <p className="text-ink-soft">
                Try a different search, fewer filters, or widen &ldquo;What can I
                cook?&rdquo; to allow a few missing ingredients.
              </p>
            </>
          )}
        </div>
      ) : (
        <RecipeGrid recipes={filtered} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire the home page.** In `src/app/(site)/page.tsx`:

Remove the `PLAN_PANTRY_QUERY` import (line `import { PLAN_PANTRY_QUERY } from "@/sanity/lib/plan-queries";`). Add to the kitchen-data import (or a new import): `import { getCookableCoverage } from "@/app/actions/kitchen-data";`.

Replace the `pantryIds` block (currently):

```ts
  // Editors get "Cook from pantry" — fetch what's currently in the pantry.
  const pantryIds = viewer.isMember
    ? ((await client
        .withConfig({ useCdn: false })
        .fetch<string[] | null>(PLAN_PANTRY_QUERY)) ?? [])
    : undefined;
```

with:

```ts
  // Members get the pantry-aware "What can I cook?" filter — precompute coverage
  // (base scale 1) for every recipe once; the client filters against it instantly.
  const coverage = viewer.isMember
    ? await getCookableCoverage(recipes.map((r) => r._id)).catch(() => undefined)
    : undefined;
```

Then change the `<CollectionView ... pantryIds={pantryIds} />` usage to `coverage={coverage}`:

```tsx
          <CollectionView
            recipes={recipes}
            ingredients={ingredients}
            tags={tags}
            coverage={coverage}
          />
```

- [ ] **Step 3: Full gate.**

Run: `npx vitest run && npm run lint && npx tsc --noEmit`
Expected: ALL green now (the downstream tsc errors from Tasks 1-3 are resolved once collection-view + home stop referencing `mode`/`pantryIds`/`filterCookable`). Note: `src/lib/pantry.ts` is now unimported but still compiles (its own `import { FilterMode } from "@/lib/recipe-filter"` references the REMOVED `FilterMode` type → this WILL be a tsc error). Fix by deleting `pantry.ts` in Task 5 — but since tsc must pass to commit cleanly, do Task 5's `pantry.ts` deletion BEFORE running the full gate here, OR run the gate at the end of Task 5. **Recommended:** skip the full gate here, commit Tasks 4's files, then do Task 5 and run the full gate there.

- [ ] **Step 4: Commit**

```bash
git add src/components/collection-view.tsx "src/app/(site)/page.tsx"
git commit -m "feat(3e): home wires getCookableCoverage into CollectionView (drops Sanity pantry filter)"
```

---

## Task 5: Cleanup — revalidate fix + deletions + final gate

**Files:** Modify `src/app/actions/kitchen-actions.ts`; delete the dead plan/pantry/migrate files.

- [ ] **Step 1: Fix `revalidate()` targets.** In `src/app/actions/kitchen-actions.ts`, replace the `revalidate` helper:

```ts
function revalidate() {
  revalidatePath("/menu");
  revalidatePath("/shop");
  revalidatePath("/pantry");
  revalidatePath("/", "layout");
}
```

- [ ] **Step 2: Confirm the dead files have no live importers.**

```bash
grep -rn "@/lib/pantry" src
grep -rn "@/sanity/lib/plan-queries\|PLAN_QUERY\|PLAN_PANTRY_QUERY\|PLAN_RECIPE_IDS_QUERY" src
grep -rn "migrate-runner\|MigrateRunner" src
```

Expected: `@/lib/pantry` → only `pantry.ts`/`pantry.test.ts`. The `plan-queries` symbols → only the definition file `src/sanity/lib/plan-queries.ts`. `migrate-runner` → only `migrate-runner.tsx` + the `admin/migrate/page.tsx` that imports it. If anything else LIVE appears, STOP and report.

- [ ] **Step 3: Delete the files.**

```bash
git rm src/lib/pantry.ts src/lib/pantry.test.ts \
       src/sanity/lib/plan-queries.ts \
       "src/app/(site)/admin/migrate/page.tsx" src/components/migrate-runner.tsx
```

(If the `admin/` directory is now empty, that's fine.)

- [ ] **Step 4: Full gate.**

Run: `npx vitest run && npm run lint && npx tsc --noEmit`
Expected: ALL green. If `tsc` flags an unresolved import, a live file referenced a deleted module — report the exact error. Paste the final test summary line.

- [ ] **Step 5: Convex smoke check.** Run: `npx convex dev --once` — expect clean.

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "refactor(3e): fix revalidate targets; delete pantry.ts, plan-queries, migrate tool"
```

---

## Post-implementation gate (whole sub-plan)

- [ ] Full gate green: `npx vitest run` + `npm run lint` + `npx tsc --noEmit` + `npx convex dev --once`.
- [ ] Holistic review across the 3e commits; address findings.
- [ ] Confirm behavior: home shows the typeahead + tag facets + (members) the cookable stepper; "Cookable now / ≤1 / ≤2 / ≤3" filters against real coverage; ingredient typeahead narrows to recipes containing the picks; signed-out users see no cookable stepper; `/admin/migrate` is gone.
- [ ] **Flag to the owner (not code):** the Sanity `mealPlan` doc + its schema (`src/sanity/schemaTypes/documents/meal-plan.ts`, `manual-item.ts`) are now fully abandoned (no code reads them). They can be removed from the Studio schema + the orphaned doc deleted whenever convenient — harmless if left.

---

## Self-review notes (coverage vs Spec 3 design §4.4 + §7)

- "typeahead ingredient search" → Task 3 ingredient typeahead + chips.
- "collapsible category facets" → tag facets kept (with show-more); collection buttons kept.
- "pantry-aware cookable-now / missing ≤N stepper wired to getCookableCoverage" → Task 1 `matchesCookable` + Task 3 stepper + Task 4 server precompute + wiring.
- "replaces button-per-ingredient + any/most/all + id-set filterCookable" → mode/MOST_THRESHOLD/matchesIngredients(coverage)/filterCookable all removed (Tasks 1, 5).
- "fix revalidatePath targets" → Task 5.
- "remove the one-time migration tool" → Task 5 (route + runner deleted; pure logic kept per the handoff's stated option).
- "retire dead plan-queries.ts" → Task 5.
- Sanity `mealPlan` schema removal → flagged to owner (Studio action), not deleted in code.
- After 3e the whole overhaul is code-complete → the final whole-project `/security-review` is the closing gate (user's call).
