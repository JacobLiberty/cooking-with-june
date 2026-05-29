# Cooking with June — Phase 4: Search / Filter / Sort Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or executing-plans. Checkbox (`- [ ]`) steps. TDD where marked.

**Goal:** On the home collection, let anyone search by name, filter by the pantry (multiple ingredients, ANY/ALL toggle) and by tag, sort (name [default] · rating · newest), get a "Surprise me" random pick, and see a June-flavored empty state — with all filter/sort state in the URL so views are shareable.

**Architecture:** The home page (Server Component) fetches the full recipe list + ingredient/tag option lists from Sanity (small dataset → filter client-side for instant interaction). A `"use client"` `CollectionView` reads filter state from the URL (`useSearchParams`), filters/sorts via **pure functions** in `src/lib/` (thoroughly unit-tested), and writes state back to the URL with `router.replace`. The page wraps `CollectionView` in `<Suspense>` so it stays statically/ISR rendered.

**Tech Stack:** Next.js 16 App Router (RSC + client islands), next-sanity, Tailwind v4, Vitest.

**Design contract:** `design.md` — heather/clay/ochre, Fraunces/Newsreader, spaced small-caps kickers, hairline rules, no emoji (PawMark for empty state). Filter controls should feel editorial (a quiet toolbar of kickers + a tag/ingredient row), not a SaaS filter panel.

## Conventions
- App code uses `@/` alias. Don't touch `src/sanity/env.ts` / `sanity.config.ts` / `sanity.cli.ts`.
- "Newest" sort uses Sanity's built-in `_createdAt`.

## File Structure
Created:
- `src/lib/recipe-filter.ts` + `.test.ts` — filter predicates + sort + `applyRecipeFilters` (HEADLINE logic, TDD)
- `src/lib/recipe-query-state.ts` + `.test.ts` — parse/serialize filters ↔ URL (pure, TDD)
- `src/components/collection-view.tsx` — client island: reads URL, filters, renders controls + grid + empty state + Surprise me
- `src/components/filter-controls.tsx` — client: search box, ingredient multi-select + ANY/ALL toggle, tag chips, sort select
Modified:
- `src/sanity/lib/queries.ts` — extend `RECIPES_QUERY`; add `INGREDIENTS_QUERY`, `TAGS_QUERY`
- `src/sanity/types.ts` — extend `RecipeCardData`; add `IngredientOption`, `TagOption`
- `src/app/(site)/page.tsx` — fetch lists, render `<Suspense><CollectionView/></Suspense>`

---

## Task 1: Extend queries + types

- [ ] **Step 1: `src/sanity/types.ts`** — add fields/types:
```ts
// add to RecipeCardData:
//   ingredientIds: string[] | null;
//   createdAt: string;
export type IngredientOption = { _id: string; name: string; category?: string };
export type TagOption = { _id: string; name: string };
```
Edit `RecipeCardData` to include `ingredientIds: string[] | null;` and `createdAt: string;` (place after `ratings`).

- [ ] **Step 2: `src/sanity/lib/queries.ts`** — extend `RECIPES_QUERY` projection by adding these two lines inside the object (after `"ratings": ...`):
```
    "ingredientIds": ingredients[].ingredient._ref,
    "createdAt": _createdAt
```
Then append two new queries:
```ts
export const INGREDIENTS_QUERY = defineQuery(`
  *[_type == "ingredient"] | order(name asc){ _id, name, category }
`);

export const TAGS_QUERY = defineQuery(`
  *[_type == "tag"] | order(name asc){ _id, name }
`);
```

- [ ] **Step 3:** `npx tsc --noEmit` clean. Commit: `git add src/sanity && git commit -m "feat: extend recipe query with ingredient ids + createdAt; add option queries"`

---

## Task 2: Filter + sort logic (TDD — headline feature)

- [ ] **Step 1: Write `src/lib/recipe-filter.test.ts`** FIRST:
```ts
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
```

- [ ] **Step 2:** Run — expect FAIL (module missing).

- [ ] **Step 3: Implement `src/lib/recipe-filter.ts`**:
```ts
import type { RecipeCardData } from "@/sanity/types";
import { averageRating } from "@/lib/rating";

export type SortKey = "name" | "rating" | "newest";
export type FilterMode = "any" | "all";

export type RecipeFilters = {
  query: string;
  ingredientIds: string[];
  mode: FilterMode;
  tags: string[];
  sort: SortKey;
};

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
        matchesTags(r, filters.tags),
    )
    .sort((a, b) => compare(a, b, filters.sort));
}
```

- [ ] **Step 4:** Run — expect PASS. Commit: `git add src/lib/recipe-filter.ts src/lib/recipe-filter.test.ts && git commit -m "feat: recipe filter + sort logic (pantry ANY/ALL, tags, search, sort)"`

---

## Task 3: URL state parse/serialize (TDD)

- [ ] **Step 1: Test `src/lib/recipe-query-state.test.ts`**:
```ts
import { describe, it, expect } from "vitest";
import { parseFilters, serializeFilters } from "@/lib/recipe-query-state";

describe("parseFilters", () => {
  it("defaults when params are empty", () => {
    expect(parseFilters(new URLSearchParams())).toEqual({
      query: "",
      ingredientIds: [],
      mode: "any",
      tags: [],
      sort: "name",
    });
  });
  it("parses all params", () => {
    const p = new URLSearchParams("q=beef&ing=a,b&mode=all&tag=Dinner,Quick&sort=rating");
    expect(parseFilters(p)).toEqual({
      query: "beef",
      ingredientIds: ["a", "b"],
      mode: "all",
      tags: ["Dinner", "Quick"],
      sort: "rating",
    });
  });
  it("ignores invalid mode/sort, falling back to defaults", () => {
    const p = new URLSearchParams("mode=weird&sort=bogus");
    const f = parseFilters(p);
    expect(f.mode).toBe("any");
    expect(f.sort).toBe("name");
  });
});

describe("serializeFilters", () => {
  it("omits defaults and round-trips non-defaults", () => {
    expect(serializeFilters({ query: "", ingredientIds: [], mode: "any", tags: [], sort: "name" })).toBe("");
    const s = serializeFilters({ query: "beef", ingredientIds: ["a", "b"], mode: "all", tags: ["Dinner"], sort: "rating" });
    const p = new URLSearchParams(s);
    expect(p.get("q")).toBe("beef");
    expect(p.get("ing")).toBe("a,b");
    expect(p.get("mode")).toBe("all");
    expect(p.get("tag")).toBe("Dinner");
    expect(p.get("sort")).toBe("rating");
  });
});
```

- [ ] **Step 2:** Run — FAIL.

- [ ] **Step 3: Implement `src/lib/recipe-query-state.ts`**:
```ts
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
```

- [ ] **Step 4:** Run — PASS. Commit: `git add src/lib/recipe-query-state.ts src/lib/recipe-query-state.test.ts && git commit -m "feat: URL <-> filter state parsing"`

---

## Task 4: FilterControls (client)

**Design:** an editorial toolbar, not a SaaS panel. Row 1: a search input (Newsreader, hairline underline, placeholder "Search recipes…") on the left; a sort `<select>` styled minimally on the right, labeled with a small-caps kicker "Sort". Row 2: tag chips (small-caps, toggle heather when active). Row 3 (pantry): a kicker "What's in your kitchen?", a wrap of ingredient toggle-chips, and an ANY/ALL segmented toggle (kicker labels "any" / "all"). All controlled via props; no data fetching here.

- [ ] **Step 1: Create `src/components/filter-controls.tsx`**:
```tsx
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
```

- [ ] **Step 2:** Commit: `git add src/components/filter-controls.tsx && git commit -m "feat: editorial filter controls (search, sort, tags, pantry ANY/ALL)"`

---

## Task 5: CollectionView (client island) + Surprise me + empty state

- [ ] **Step 1: Create `src/components/collection-view.tsx`**:
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
  type RecipeFilters,
} from "@/lib/recipe-filter";
import { parseFilters, serializeFilters } from "@/lib/recipe-query-state";
import { FilterControls } from "@/components/filter-controls";
import { RecipeGrid } from "@/components/recipe-grid";
import { PawMark } from "@/components/paw-mark";

export function CollectionView({
  recipes,
  ingredients,
  tags,
}: {
  recipes: RecipeCardData[];
  ingredients: IngredientOption[];
  tags: TagOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => parseFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const setFilters = useCallback(
    (next: RecipeFilters) => {
      const qs = serializeFilters(next);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const filtered = useMemo(
    () => applyRecipeFilters(recipes, filters),
    [recipes, filters],
  );

  const surprise = useCallback(() => {
    if (filtered.length === 0) return;
    // index varies by list identity; deterministic-enough for a fun pick
    const pick = filtered[Math.floor((Date.now() / 1000) % filtered.length)];
    router.push(`/recipe/${pick.slug}`);
  }, [filtered, router]);

  return (
    <div className="space-y-8">
      <FilterControls
        filters={filters}
        ingredients={ingredients}
        tags={tags}
        onChange={setFilters}
      />

      <div className="flex items-center justify-between border-t border-heather/25 pt-4">
        <span className="kicker text-ink-soft">
          {filtered.length} {filtered.length === 1 ? "recipe" : "recipes"}
        </span>
        <button
          type="button"
          onClick={surprise}
          disabled={filtered.length === 0}
          className="kicker text-heather hover:text-heather-deep disabled:opacity-40"
        >
          Surprise me
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <PawMark className="h-8 w-8 text-clay/70" />
          <p className="editorial-display text-2xl text-ink">Nothing here</p>
          <p className="text-ink-soft">
            Try fewer ingredients, or switch the match to “any.”
          </p>
        </div>
      ) : (
        <RecipeGrid recipes={filtered} />
      )}
    </div>
  );
}
```
> Note on Surprise me: it avoids `Math.random()` in render but uses `Date.now()` inside the click handler (event time, not render) — safe for hydration. Acceptable for a playful pick.

- [ ] **Step 2:** Commit: `git add src/components/collection-view.tsx && git commit -m "feat: CollectionView island with URL state, Surprise me, empty state"`

---

## Task 6: Wire the home page

- [ ] **Step 1: Replace `src/app/(site)/page.tsx`**:
```tsx
import { Suspense } from "react";
import { client } from "@/sanity/lib/client";
import {
  RECIPES_QUERY,
  INGREDIENTS_QUERY,
  TAGS_QUERY,
} from "@/sanity/lib/queries";
import type {
  RecipeCardData,
  IngredientOption,
  TagOption,
} from "@/sanity/types";
import { CollectionView } from "@/components/collection-view";

export const revalidate = 60;

export default async function HomePage() {
  const [recipes, ingredients, tags] = await Promise.all([
    client.fetch<RecipeCardData[]>(RECIPES_QUERY),
    client.fetch<IngredientOption[]>(INGREDIENTS_QUERY),
    client.fetch<TagOption[]>(TAGS_QUERY),
  ]);

  return (
    <section>
      <header className="set set-1">
        <p className="kicker text-heather">The collection</p>
        <h1 className="editorial-display mt-2 text-5xl text-ink md:text-6xl">
          Cooking with June
        </h1>
        <div className="rule-draw mt-5 h-px w-full bg-heather/40" />
      </header>

      <div className="set set-2 mt-8">
        <Suspense fallback={null}>
          <CollectionView recipes={recipes} ingredients={ingredients} tags={tags} />
        </Suspense>
      </div>
    </section>
  );
}
```
> `<Suspense>` is required because `CollectionView` calls `useSearchParams()`; without it the route would be forced fully dynamic.

- [ ] **Step 2: Verify** with env: `NEXT_PUBLIC_SANITY_PROJECT_ID=zwjctldy NEXT_PUBLIC_SANITY_DATASET=production npm run build` — compiles; `/` present. Commit: `git add "src/app/(site)/page.tsx" && git commit -m "feat: wire search/filter/sort into the home collection"`

---

## Task 7: Phase gate
- [ ] **Step 1:** `npm test` (prior 24 + recipe-filter ~7 + query-state ~5 ≈ 36), `npm run lint` (0), `npx tsc --noEmit`, `npm audit` (0), and the env-prefixed `npm run build`. All clean.
- [ ] **Step 2:** Report results.

---

## Self-Review
**Spec coverage (Phase 4: name search, pantry ANY/ALL multi-select, tag filter, sort name/rating/newest, URL state, Surprise me, June empty state):** search (matchesQuery + input) ✓; pantry ANY/ALL (matchesIngredients + toggle) ✓; tags (matchesTags + chips) ✓; sort (compare + select) ✓; URL state (recipe-query-state + CollectionView) ✓; Surprise me ✓; empty state ✓.
**Design.md:** editorial controls (kickers, hairline underline inputs, heather/clay chips), PawMark empty state, no emoji. No SaaS filter panel, no shadows.
**Placeholders:** none — all code complete.
**Type consistency:** `RecipeFilters`/`SortKey`/`FilterMode` defined in `recipe-filter.ts`, consumed by `recipe-query-state.ts`, `filter-controls.tsx`, `collection-view.tsx`. `RecipeCardData` extended with `ingredientIds`/`createdAt` and the query projects them. `IngredientOption`/`TagOption` flow from queries → page → CollectionView → FilterControls.
**Risk:** client-side filtering assumes the full recipe list is fetched (fine for a personal cookbook; if it grows to hundreds, move filtering server-side via GROQ params — noted for future). `useSearchParams` requires the `<Suspense>` boundary (added).
