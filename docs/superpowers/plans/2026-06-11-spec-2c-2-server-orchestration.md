# Spec 2c-2 — Server orchestration (Sanity + 2b + Convex glue) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the kitchen loop end-to-end on the server: assemble Sanity recipe/ingredient data + Convex per-household state, run the Spec 2b pure math, and drive the Spec 2c-1 Convex mutations — exposing loop **server actions** (buy/cook/plan/grocery/pantry) and **read/data functions** (plan/pantry/shop/cookable) that Spec 3's UI will consume.

**Architecture:** Convex cannot read Sanity, so Next.js server functions are the join point. Pure assembly helpers (tested in isolation) convert raw Sanity GROQ rows into the Spec 2b shapes (`RecipeLine[]`, `metaFor`, pantry `Map`) and marshal results back into Convex mutation args. Server actions follow the existing pattern: `requireMember()` + `fetchQuery`/`fetchMutation` from `convex/nextjs` with `{ token: await convexAuthNextjsToken() }`. Grocery plan-needs are **computed** here (never stored); `skip` auto-clear is reconciled here after state-changing actions.

**Tech Stack:** Next.js server actions, `convex/nextjs` (`fetchQuery`/`fetchMutation`), `@convex-dev/auth/nextjs/server` (`convexAuthNextjsToken`), `@sanity/client` reader, the `src/lib/kitchen` pure lib (Spec 2b), the `@cvx/_generated/api` Convex API. Vitest with mocks (mirror [src/app/actions/plan-actions.test.ts](../../../src/app/actions/plan-actions.test.ts)).

**Parent spec:** [docs/superpowers/specs/2026-06-11-cooking-with-june-spec-2-pantry-design.md](../specs/2026-06-11-cooking-with-june-spec-2-pantry-design.md) §7.

**SCOPE NOTE (approved):** This delivers the **backend** of the cookable rewire — a server-side quantity-aware coverage function + read API. The **live interactive home filter** (currently client `CollectionView` over a Sanity pantry-id set) and **retiring `src/lib/pantry.ts` `filterCookable`** are **deferred to Spec 3**, which reworks that UI. Do NOT modify `page.tsx`, `CollectionView`, or `src/lib/pantry.ts` here.

**Established server-side Convex pattern (copy this):**
```ts
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@cvx/_generated/api";
// inside an action, after requireMember():
const token = await convexAuthNextjsToken();
await fetchMutation(api.plan.addToPlan, { recipeId, scale }, { token });
```

---

## File Structure

- `src/lib/kitchen/assemble.ts` + `assemble.test.ts` — **create**: pure helpers turning raw Sanity rows + Convex rows into Spec 2b inputs and back.
- `src/sanity/lib/kitchen-queries.ts` — **create**: GROQ to fetch recipe requirement data + a single ingredient's restock metadata.
- `src/app/actions/kitchen-data.ts` + `kitchen-data.test.ts` — **create**: read/assembly functions (plan / pantry / shop / cookable coverage).
- `src/app/actions/kitchen-actions.ts` + `kitchen-actions.test.ts` — **create**: the loop server actions + skip reconciliation.

Pure logic lives in `assemble.ts` (heavily tested); the action/data files are thin glue tested with mocks.

---

## Task 1: Pure assembly helpers

**Files:**
- Create: `src/lib/kitchen/assemble.ts`
- Test: `src/lib/kitchen/assemble.test.ts`

These convert raw GROQ rows into Spec 2b shapes and marshal back. `RawLine` is the shape returned by the requirement GROQ (Task 2).

- [ ] **Step 1: Write the failing test**

`src/lib/kitchen/assemble.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  toIngredientInfo,
  toRecipeLines,
  buildMetaFor,
  buildPantryMap,
  deltasToArray,
  restockToCanonical,
  type RawLine,
} from "@/lib/kitchen/assemble";

const beefLine: RawLine = {
  ingredientId: "beef",
  name: "ground beef",
  quantity: "1",
  unit: "lb",
  optional: false,
  canonicalUnitKind: "mass",
  density: null,
  avgUnitGrams: null,
  category: "protein",
  restockQuantity: { quantity: 1, unit: "kg" },
};
const eggLine: RawLine = {
  ingredientId: "egg",
  name: "egg",
  quantity: "2",
  unit: "",
  optional: true,
  canonicalUnitKind: "count",
  density: null,
  avgUnitGrams: 50,
  category: "produce",
  restockQuantity: { quantity: 12, unit: "" },
};
const unenriched: RawLine = {
  ingredientId: "mystery",
  name: "unobtainium",
  quantity: "1",
  unit: "g",
  optional: false,
  canonicalUnitKind: null,
  density: null,
  avgUnitGrams: null,
  category: null,
  restockQuantity: null,
};

describe("toIngredientInfo", () => {
  it("narrows a valid raw line to IngredientInfo", () => {
    expect(toIngredientInfo(beefLine)).toEqual({
      canonicalUnitKind: "mass",
      density: undefined,
      avgUnitGrams: undefined,
      category: "protein",
    });
    expect(toIngredientInfo(eggLine)).toMatchObject({
      canonicalUnitKind: "count",
      avgUnitGrams: 50,
      category: "produce",
    });
  });

  it("returns null when metadata is missing/invalid (un-enriched)", () => {
    expect(toIngredientInfo(unenriched)).toBeNull();
  });

  it("returns null for an unknown category or kind", () => {
    expect(toIngredientInfo({ ...beefLine, category: "snacks" })).toBeNull();
    expect(toIngredientInfo({ ...beefLine, canonicalUnitKind: "blob" })).toBeNull();
  });
});

describe("toRecipeLines", () => {
  it("maps raw lines to RecipeLine shape", () => {
    expect(toRecipeLines([beefLine, eggLine])).toEqual([
      { ingredientId: "beef", name: "ground beef", quantity: "1", unit: "lb", optional: false },
      { ingredientId: "egg", name: "egg", quantity: "2", unit: "", optional: true },
    ]);
  });
});

describe("buildMetaFor", () => {
  it("returns a lookup that resolves enriched ingredients and skips un-enriched", () => {
    const metaFor = buildMetaFor([beefLine, eggLine, unenriched]);
    expect(metaFor("beef")?.category).toBe("protein");
    expect(metaFor("egg")?.avgUnitGrams).toBe(50);
    expect(metaFor("mystery")).toBeUndefined();
  });
});

describe("buildPantryMap", () => {
  it("maps pantry rows to ingredientId -> quantityG", () => {
    const m = buildPantryMap([
      { ingredientId: "beef", quantityG: 300 },
      { ingredientId: "egg", quantityG: 6 },
    ]);
    expect(m.get("beef")).toBe(300);
    expect(m.get("egg")).toBe(6);
  });
});

describe("deltasToArray", () => {
  it("converts a Map to the cook mutation's array shape", () => {
    const arr = deltasToArray(new Map([["beef", 200], ["egg", 2]]));
    expect(arr).toEqual(
      expect.arrayContaining([
        { ingredientId: "beef", subtract: 200 },
        { ingredientId: "egg", subtract: 2 },
      ]),
    );
    expect(arr).toHaveLength(2);
  });
});

describe("restockToCanonical", () => {
  it("converts a restock {quantity, unit} to a canonical amount", () => {
    // beef mass-kind, 1 kg -> 1000 g
    const g = restockToCanonical({ quantity: 1, unit: "kg" }, toIngredientInfo(beefLine)!, "ground beef");
    expect(g).toBe(1000);
    // egg count-kind, 12 "" -> 12 count
    const c = restockToCanonical({ quantity: 12, unit: "" }, toIngredientInfo(eggLine)!, "egg");
    expect(c).toBe(12);
  });

  it("returns null when the restock can't be converted", () => {
    expect(
      restockToCanonical({ quantity: 1, unit: "smidgen" }, toIngredientInfo(beefLine)!, "ground beef"),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/kitchen/assemble.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/kitchen/assemble.ts`:

```ts
import { lineToCanonical } from "@/lib/kitchen/convert";
import type { IngredientInfo, RecipeLine } from "@/lib/kitchen/types";
import {
  CANONICAL_UNIT_KINDS,
  INGREDIENT_CATEGORIES,
  type CanonicalUnitKind,
  type IngredientCategory,
} from "@/lib/enrichment/types";

/** A recipe ingredient line as returned by the requirement GROQ (Task 2). */
export type RawLine = {
  ingredientId: string;
  name: string;
  quantity?: string | null;
  unit?: string | null;
  optional?: boolean | null;
  canonicalUnitKind?: string | null;
  density?: number | null;
  avgUnitGrams?: number | null;
  category?: string | null;
  restockQuantity?: { quantity?: number; unit?: string } | null;
};

const isKind = (x: unknown): x is CanonicalUnitKind =>
  typeof x === "string" && (CANONICAL_UNIT_KINDS as readonly string[]).includes(x);
const isCategory = (x: unknown): x is IngredientCategory =>
  typeof x === "string" && (INGREDIENT_CATEGORIES as readonly string[]).includes(x);

/** Narrow a raw line's metadata to IngredientInfo, or null if un-enriched/invalid. */
export function toIngredientInfo(raw: RawLine): IngredientInfo | null {
  if (!isKind(raw.canonicalUnitKind) || !isCategory(raw.category)) return null;
  return {
    canonicalUnitKind: raw.canonicalUnitKind,
    density: typeof raw.density === "number" ? raw.density : undefined,
    avgUnitGrams: typeof raw.avgUnitGrams === "number" ? raw.avgUnitGrams : undefined,
    category: raw.category,
  };
}

export function toRecipeLines(raw: RawLine[]): RecipeLine[] {
  return raw.map((r) => ({
    ingredientId: r.ingredientId,
    name: r.name,
    quantity: r.quantity ?? null,
    unit: r.unit ?? null,
    optional: r.optional ?? false,
  }));
}

/** A metaFor lookup over raw lines; un-enriched ingredients resolve to undefined. */
export function buildMetaFor(
  raw: RawLine[],
): (ingredientId: string) => IngredientInfo | undefined {
  const map = new Map<string, IngredientInfo>();
  for (const r of raw) {
    const info = toIngredientInfo(r);
    if (info) map.set(r.ingredientId, info);
  }
  return (id) => map.get(id);
}

export function buildPantryMap(
  rows: { ingredientId: string; quantityG: number }[],
): Map<string, number> {
  return new Map(rows.map((r) => [r.ingredientId, r.quantityG]));
}

export function deltasToArray(
  deltas: Map<string, number>,
): { ingredientId: string; subtract: number }[] {
  return [...deltas].map(([ingredientId, subtract]) => ({ ingredientId, subtract }));
}

/** Convert a restock {quantity, unit} to the ingredient's canonical amount, or null. */
export function restockToCanonical(
  restock: { quantity?: number; unit?: string } | null | undefined,
  info: IngredientInfo,
  name: string,
): number | null {
  if (!restock || typeof restock.quantity !== "number") return null;
  const r = lineToCanonical(String(restock.quantity), restock.unit ?? "", info, name);
  return r.ok ? r.amount : null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/lib/kitchen/assemble.test.ts`
Expected: PASS. Then `npx tsc --noEmit` (clean).

- [ ] **Step 5: Commit**

```bash
git add src/lib/kitchen/assemble.ts src/lib/kitchen/assemble.test.ts
git commit -m "feat(2c-2): pure assembly helpers (raw Sanity rows <-> Spec 2b shapes)"
```

---

## Task 2: Sanity requirement queries

**Files:**
- Create: `src/sanity/lib/kitchen-queries.ts`

GROQ constants (no unit test — query strings; they're exercised via the data/action tests with mocked Sanity). These dereference each ingredient line to its name + stock metadata.

- [ ] **Step 1: Implement**

`src/sanity/lib/kitchen-queries.ts`:

```ts
import { defineQuery } from "next-sanity";

/**
 * Requirement data for a set of recipes: each recipe's ingredient lines with the
 * dereferenced ingredient name + stock metadata, ready for the Spec 2b lib.
 */
export const RECIPE_REQUIREMENTS_QUERY = defineQuery(`
  *[_type == "recipe" && _id in $ids]{
    _id,
    servings,
    "lines": ingredients[]{
      "ingredientId": ingredient._ref,
      "name": ingredient->name,
      quantity,
      unit,
      optional,
      "canonicalUnitKind": ingredient->canonicalUnitKind,
      "density": ingredient->density,
      "avgUnitGrams": ingredient->avgUnitGrams,
      "category": ingredient->category,
      "restockQuantity": ingredient->restockQuantity
    }
  }
`);

/** Restock metadata for a single ingredient (for the buy flow). */
export const INGREDIENT_RESTOCK_QUERY = defineQuery(`
  *[_type == "ingredient" && _id == $id][0]{
    _id,
    name,
    canonicalUnitKind,
    density,
    avgUnitGrams,
    category,
    restockQuantity
  }
`);

import type { RawLine } from "@/lib/kitchen/assemble";

export type RecipeRequirementDoc = {
  _id: string;
  servings?: number | null;
  lines: RawLine[] | null;
};

export type IngredientRestockDoc = RawLine & { _id: string };
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (clean — confirms the GROQ + types compile and `RawLine` import resolves).

```bash
git add src/sanity/lib/kitchen-queries.ts
git commit -m "feat(2c-2): Sanity GROQ for recipe requirements + ingredient restock"
```

---

## Task 3: Read / data API

**Files:**
- Create: `src/app/actions/kitchen-data.ts`
- Test: `src/app/actions/kitchen-data.test.ts`

Server functions that assemble views for Spec 3. Pure assembly is delegated to `assemble.ts` + the 2b lib; this file fetches + orchestrates. Tests mock `convex/nextjs`, the auth token, and the Sanity client.

Functions:
- `getPantryData()` → the household's pantry rows (passthrough of `api.pantry.pantry`).
- `getPlanData()` → planned recipes with `{ recipeId, scale, coverage }` where coverage = `recipeCoverage(thisRecipeRequirements, pantryMap)`.
- `getShopData()` → `{ needs, manual, skipped }`: computed plan needs (`computeNeeds` over flattened requirements of all planned recipes, minus pantry), the manual grocery rows, and the set of skipped ingredient ids. Plan needs whose ingredient is skipped are excluded.
- `getCookableCoverage(recipeIds)` → `Record<recipeId, {cookable, missingRequired}>` for the given recipes (the quantity-aware home-filter backend).

- [ ] **Step 1: Write the failing test**

`src/app/actions/kitchen-data.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/viewer", () => ({ requireMember: vi.fn() }));
vi.mock("@convex-dev/auth/nextjs/server", () => ({
  convexAuthNextjsToken: vi.fn().mockResolvedValue("tok"),
}));
const fetchQuery = vi.fn();
vi.mock("convex/nextjs", () => ({ fetchQuery: (...a: unknown[]) => fetchQuery(...a) }));
const sanityFetch = vi.fn();
vi.mock("@/sanity/lib/client", () => ({
  client: { withConfig: () => ({ fetch: (...a: unknown[]) => sanityFetch(...a) }) },
}));

import { requireMember } from "@/lib/viewer";
import { getShopData, getCookableCoverage } from "@/app/actions/kitchen-data";

const REQS = [
  {
    _id: "r1",
    servings: 2,
    lines: [
      { ingredientId: "beef", name: "beef", quantity: "1", unit: "lb", optional: false,
        canonicalUnitKind: "mass", density: null, avgUnitGrams: null, category: "protein", restockQuantity: null },
      { ingredientId: "herb", name: "herb", quantity: "10", unit: "g", optional: true,
        canonicalUnitKind: "mass", density: null, avgUnitGrams: null, category: "spice", restockQuantity: null },
    ],
  },
];

beforeEach(() => {
  vi.mocked(requireMember).mockResolvedValue({ userId: "u1", householdId: "h1" });
  fetchQuery.mockReset();
  sanityFetch.mockReset();
});

describe("getShopData", () => {
  it("computes plan needs minus pantry, excludes skipped, includes manual", async () => {
    // plan: r1 scale 1 ; pantry: beef 100g ; grocery: skip herb, manual salt
    fetchQuery
      .mockResolvedValueOnce([{ recipeId: "r1", scale: 1, addedAt: 1 }]) // plan
      .mockResolvedValueOnce([{ ingredientId: "beef", quantityG: 100, restockOverride: null, updatedAt: 1 }]) // pantry
      .mockResolvedValueOnce([
        { ingredientId: "herb", source: "skip", manualQuantity: null },
        { ingredientId: "salt", source: "manual", manualQuantity: { quantity: 1, unit: "box" } },
      ]); // grocery
    sanityFetch.mockResolvedValueOnce(REQS);

    const data = await getShopData();
    // beef need = 453.6 - 100 = 353.6 (required) ; herb optional+skipped excluded
    const beef = data.needs.find((n) => n.ingredientId === "beef");
    expect(beef?.amount).toBeCloseTo(353.6);
    expect(data.needs.some((n) => n.ingredientId === "herb")).toBe(false);
    expect(data.manual.map((m) => m.ingredientId)).toEqual(["salt"]);
    expect(data.skipped).toEqual(["herb"]);
  });
});

describe("getCookableCoverage", () => {
  it("returns per-recipe coverage against the pantry", async () => {
    fetchQuery.mockResolvedValueOnce([
      { ingredientId: "beef", quantityG: 500, restockOverride: null, updatedAt: 1 },
    ]); // pantry
    sanityFetch.mockResolvedValueOnce(REQS);
    const cov = await getCookableCoverage(["r1"]);
    // beef required 453.6g, have 500 -> cookable; herb optional ignored
    expect(cov.r1).toEqual({ cookable: true, missingRequired: 0 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/app/actions/kitchen-data.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/app/actions/kitchen-data.ts`:

```ts
"use server";

import { fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@cvx/_generated/api";
import { client } from "@/sanity/lib/client";
import { requireMember } from "@/lib/viewer";
import {
  RECIPE_REQUIREMENTS_QUERY,
  type RecipeRequirementDoc,
} from "@/sanity/lib/kitchen-queries";
import { buildMetaFor, buildPantryMap } from "@/lib/kitchen/assemble";
import { recipeRequirements } from "@/lib/kitchen/requirements";
import { computeNeeds } from "@/lib/kitchen/need";
import { recipeCoverage } from "@/lib/kitchen/cookable";
import type { IngredientRequirement } from "@/lib/kitchen/types";

const reader = () => client.withConfig({ useCdn: false });

async function fetchRequirements(ids: string[]): Promise<RecipeRequirementDoc[]> {
  if (ids.length === 0) return [];
  return (await reader().fetch(RECIPE_REQUIREMENTS_QUERY, { ids })) ?? [];
}

type PantryRow = { ingredientId: string; quantityG: number };

export async function getPantryData() {
  await requireMember();
  const token = await convexAuthNextjsToken();
  return await fetchQuery(api.pantry.pantry, {}, token ? { token } : {});
}

export async function getCookableCoverage(
  recipeIds: string[],
): Promise<Record<string, { cookable: boolean; missingRequired: number }>> {
  await requireMember();
  const token = await convexAuthNextjsToken();
  const [pantryRows, reqDocs] = await Promise.all([
    fetchQuery(api.pantry.pantry, {}, token ? { token } : {}) as Promise<PantryRow[]>,
    fetchRequirements(recipeIds),
  ]);
  const pantry = buildPantryMap(pantryRows);
  const out: Record<string, { cookable: boolean; missingRequired: number }> = {};
  for (const doc of reqDocs) {
    const lines = doc.lines ?? [];
    const metaFor = buildMetaFor(lines);
    const { requirements } = recipeRequirements(toLines(lines), 1, metaFor);
    out[doc._id] = recipeCoverage(requirements, pantry);
  }
  return out;
}

export async function getShopData() {
  await requireMember();
  const token = await convexAuthNextjsToken();
  const opts = token ? { token } : {};
  const [planRows, pantryRows, groceryRows] = await Promise.all([
    fetchQuery(api.plan.plan, {}, opts) as Promise<{ recipeId: string; scale: number }[]>,
    fetchQuery(api.pantry.pantry, {}, opts) as Promise<PantryRow[]>,
    fetchQuery(api.grocery.grocery, {}, opts) as Promise<
      { ingredientId: string; source: "manual" | "skip"; manualQuantity: { quantity: number; unit: string } | null }[]
    >,
  ]);
  const reqDocs = await fetchRequirements(planRows.map((p) => p.recipeId));
  const scaleById = new Map(planRows.map((p) => [p.recipeId, p.scale]));

  // Flatten all planned recipes' requirements (needed for the optional-grouping rule).
  const all: IngredientRequirement[] = [];
  for (const doc of reqDocs) {
    const lines = doc.lines ?? [];
    const metaFor = buildMetaFor(lines);
    const { requirements } = recipeRequirements(
      toLines(lines),
      scaleById.get(doc._id) ?? 1,
      metaFor,
    );
    all.push(...requirements);
  }

  const pantry = buildPantryMap(pantryRows);
  const skipped = groceryRows.filter((g) => g.source === "skip").map((g) => g.ingredientId);
  const skipSet = new Set(skipped);
  const needs = computeNeeds(all, pantry).filter((n) => !skipSet.has(n.ingredientId));
  const manual = groceryRows.filter((g) => g.source === "manual");
  return { needs, manual, skipped };
}

export async function getPlanData() {
  await requireMember();
  const token = await convexAuthNextjsToken();
  const opts = token ? { token } : {};
  const [planRows, pantryRows] = await Promise.all([
    fetchQuery(api.plan.plan, {}, opts) as Promise<{ recipeId: string; scale: number }[]>,
    fetchQuery(api.pantry.pantry, {}, opts) as Promise<PantryRow[]>,
  ]);
  const reqDocs = await fetchRequirements(planRows.map((p) => p.recipeId));
  const pantry = buildPantryMap(pantryRows);
  const byId = new Map(reqDocs.map((d) => [d._id, d]));
  return planRows.map((p) => {
    const doc = byId.get(p.recipeId);
    const lines = doc?.lines ?? [];
    const metaFor = buildMetaFor(lines);
    const { requirements } = recipeRequirements(toLines(lines), p.scale, metaFor);
    return { recipeId: p.recipeId, scale: p.scale, coverage: recipeCoverage(requirements, pantry) };
  });
}

// Local re-export to keep the toRecipeLines import name explicit in this file.
import { toRecipeLines as toLines } from "@/lib/kitchen/assemble";
```

**NOTE for the implementer:** move the `import { toRecipeLines as toLines }` to the top with the other imports (it's shown at the bottom only for readability). Confirm the Sanity mock in the test (`client.withConfig().fetch`) matches how `reader()` calls it.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/app/actions/kitchen-data.test.ts`
Expected: PASS. Then `npx tsc --noEmit` (clean).

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/kitchen-data.ts src/app/actions/kitchen-data.test.ts
git commit -m "feat(2c-2): kitchen read API (pantry/plan/shop/cookable coverage)"
```

---

## Task 4: Loop server actions + skip reconciliation

**Files:**
- Create: `src/app/actions/kitchen-actions.ts`
- Test: `src/app/actions/kitchen-actions.test.ts`

The loop mutations Spec 3 will call. Thin actions: `requireMember()`, fetch what's needed, compute via the helpers/2b, call Convex mutations. `cook` and `markBought` reconcile stale skips afterward.

Actions: `addToPlan(recipeId, scale)`, `removeFromPlan(recipeId)`, `setScale(recipeId, scale)`, `markBought(ingredientId)`, `cook(recipeId, usedOptionalIds)`, `addManualItem(ingredientId, manualQuantity?)`, `removeManualItem(ingredientId)`, `skipItem(ingredientId)`, `unskipItem(ingredientId)`, `setPantryQuantity(ingredientId, quantityG)`, `setRestockOverride(ingredientId, restock?)`.

- [ ] **Step 1: Write the failing test**

`src/app/actions/kitchen-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/viewer", () => ({ requireMember: vi.fn() }));
vi.mock("@convex-dev/auth/nextjs/server", () => ({
  convexAuthNextjsToken: vi.fn().mockResolvedValue("tok"),
}));
const fetchMutation = vi.fn().mockResolvedValue(undefined);
const fetchQuery = vi.fn();
vi.mock("convex/nextjs", () => ({
  fetchMutation: (...a: unknown[]) => fetchMutation(...a),
  fetchQuery: (...a: unknown[]) => fetchQuery(...a),
}));
const sanityFetch = vi.fn();
vi.mock("@/sanity/lib/client", () => ({
  client: { withConfig: () => ({ fetch: (...a: unknown[]) => sanityFetch(...a) }) },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { requireMember } from "@/lib/viewer";
import { api } from "@cvx/_generated/api";
import {
  addToPlan,
  cook,
  markBought,
} from "@/app/actions/kitchen-actions";

beforeEach(() => {
  vi.mocked(requireMember).mockResolvedValue({ userId: "u1", householdId: "h1" });
  fetchMutation.mockClear();
  fetchQuery.mockReset();
  sanityFetch.mockReset();
});

describe("addToPlan", () => {
  it("calls the plan mutation with a normalized scale", async () => {
    await addToPlan("r1", 2);
    expect(fetchMutation).toHaveBeenCalledWith(
      api.plan.addToPlan,
      { recipeId: "r1", scale: 2 },
      { token: "tok" },
    );
  });
});

describe("cook", () => {
  it("computes depletion deltas from the recipe + scale and calls cook", async () => {
    // plan scale 2 for r1 ; recipe r1 has 1 lb beef (required) + 2 optional eggs
    fetchQuery
      .mockResolvedValueOnce([{ recipeId: "r1", scale: 2 }]) // plan (for scale)
      .mockResolvedValueOnce([]) // pantry (reconcile)
      .mockResolvedValueOnce([]) // grocery (reconcile)
      .mockResolvedValueOnce([]); // plan (reconcile)
    sanityFetch
      .mockResolvedValueOnce([
        {
          _id: "r1",
          servings: 2,
          lines: [
            { ingredientId: "beef", name: "beef", quantity: "1", unit: "lb", optional: false,
              canonicalUnitKind: "mass", density: null, avgUnitGrams: null, category: "protein", restockQuantity: null },
            { ingredientId: "egg", name: "egg", quantity: "2", unit: "", optional: true,
              canonicalUnitKind: "count", density: null, avgUnitGrams: 50, category: "produce", restockQuantity: null },
          ],
        },
      ]) // cook requirements
      .mockResolvedValueOnce([]); // reconcile requirements (no plan left)

    await cook("r1", ["egg"]);

    const call = fetchMutation.mock.calls.find((c) => c[0] === api.cook.cook);
    expect(call).toBeTruthy();
    const args = call![1] as { recipeId: string; deltas: { ingredientId: string; subtract: number }[] };
    expect(args.recipeId).toBe("r1");
    const beef = args.deltas.find((d) => d.ingredientId === "beef");
    const egg = args.deltas.find((d) => d.ingredientId === "egg");
    expect(beef?.subtract).toBeCloseTo(2 * 453.6); // 1 lb * scale 2
    expect(egg?.subtract).toBe(4); // 2 eggs * scale 2, used
  });
});

describe("markBought", () => {
  it("adds the restock (catalog) amount to the pantry and removes the manual row", async () => {
    fetchQuery
      .mockResolvedValueOnce([]) // pantry (no override) — used to resolve restockOverride
      .mockResolvedValueOnce([]) // pantry (reconcile)
      .mockResolvedValueOnce([]) // grocery (reconcile)
      .mockResolvedValueOnce([]); // plan (reconcile)
    sanityFetch
      .mockResolvedValueOnce({
        _id: "beef", name: "beef",
        canonicalUnitKind: "mass", density: null, avgUnitGrams: null, category: "protein",
        restockQuantity: { quantity: 1, unit: "kg" },
      }) // ingredient restock
      .mockResolvedValueOnce([]); // reconcile requirements

    await markBought("beef");

    expect(fetchMutation).toHaveBeenCalledWith(
      api.pantry.adjustPantry,
      { ingredientId: "beef", deltaG: 1000 },
      { token: "tok" },
    );
    expect(fetchMutation).toHaveBeenCalledWith(
      api.grocery.removeManualItem,
      { ingredientId: "beef" },
      { token: "tok" },
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/app/actions/kitchen-actions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/app/actions/kitchen-actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@cvx/_generated/api";
import { client } from "@/sanity/lib/client";
import { requireMember } from "@/lib/viewer";
import {
  RECIPE_REQUIREMENTS_QUERY,
  INGREDIENT_RESTOCK_QUERY,
  type RecipeRequirementDoc,
  type IngredientRestockDoc,
} from "@/sanity/lib/kitchen-queries";
import {
  buildMetaFor,
  buildPantryMap,
  deltasToArray,
  toIngredientInfo,
  toRecipeLines,
  restockToCanonical,
} from "@/lib/kitchen/assemble";
import { recipeRequirements } from "@/lib/kitchen/requirements";
import { depletionDeltas } from "@/lib/kitchen/deplete";
import { computeNeeds } from "@/lib/kitchen/need";
import type { IngredientRequirement } from "@/lib/kitchen/types";

const reader = () => client.withConfig({ useCdn: false });
const tokenOpts = async () => {
  const token = await convexAuthNextjsToken();
  return token ? { token } : {};
};

type PantryRow = { ingredientId: string; quantityG: number; restockOverride: { quantity: number; unit: string } | null };

function revalidate() {
  revalidatePath("/plan");
  revalidatePath("/", "layout");
}

// ── Plan ────────────────────────────────────────────────────────────────────

export async function addToPlan(recipeId: string, scale = 1) {
  await requireMember();
  await fetchMutation(api.plan.addToPlan, { recipeId, scale }, await tokenOpts());
  revalidate();
}

export async function removeFromPlan(recipeId: string) {
  await requireMember();
  const opts = await tokenOpts();
  await fetchMutation(api.plan.removeFromPlan, { recipeId }, opts);
  await reconcileSkips(opts);
  revalidate();
}

export async function setScale(recipeId: string, scale: number) {
  await requireMember();
  await fetchMutation(api.plan.setScale, { recipeId, scale }, await tokenOpts());
  revalidate();
}

// ── Buy / Cook ────────────────────────────────────────────────────────────────

export async function markBought(ingredientId: string) {
  await requireMember();
  const opts = await tokenOpts();
  const [pantryRows, ing] = await Promise.all([
    fetchQuery(api.pantry.pantry, {}, opts) as Promise<PantryRow[]>,
    reader().fetch<IngredientRestockDoc | null>(INGREDIENT_RESTOCK_QUERY, { id: ingredientId }),
  ]);
  if (ing) {
    const info = toIngredientInfo(ing);
    const override = pantryRows.find((p) => p.ingredientId === ingredientId)?.restockOverride ?? null;
    const restock = override ?? ing.restockQuantity ?? null;
    const amount = info ? restockToCanonical(restock, info, ing.name) : null;
    if (amount != null && amount > 0) {
      await fetchMutation(api.pantry.adjustPantry, { ingredientId, deltaG: amount }, opts);
    }
  }
  await fetchMutation(api.grocery.removeManualItem, { ingredientId }, opts);
  await reconcileSkips(opts);
  revalidate();
}

export async function cook(recipeId: string, usedOptionalIds: string[] = []) {
  await requireMember();
  const opts = await tokenOpts();
  const planRows = (await fetchQuery(api.plan.plan, {}, opts)) as { recipeId: string; scale: number }[];
  const scale = planRows.find((p) => p.recipeId === recipeId)?.scale ?? 1;
  const docs = (await reader().fetch<RecipeRequirementDoc[]>(RECIPE_REQUIREMENTS_QUERY, {
    ids: [recipeId],
  })) ?? [];
  const lines = docs[0]?.lines ?? [];
  const metaFor = buildMetaFor(lines);
  const { requirements } = recipeRequirements(toRecipeLines(lines), scale, metaFor);
  const deltas = deltasToArray(depletionDeltas(requirements, new Set(usedOptionalIds)));
  await fetchMutation(api.cook.cook, { recipeId, at: Date.now(), deltas }, opts);
  await reconcileSkips(opts);
  revalidate();
}

// ── Manual grocery + pantry corrections ───────────────────────────────────────

export async function addManualItem(
  ingredientId: string,
  manualQuantity?: { quantity: number; unit: string },
) {
  await requireMember();
  await fetchMutation(api.grocery.addManualItem, { ingredientId, manualQuantity }, await tokenOpts());
  revalidate();
}

export async function removeManualItem(ingredientId: string) {
  await requireMember();
  await fetchMutation(api.grocery.removeManualItem, { ingredientId }, await tokenOpts());
  revalidate();
}

export async function skipItem(ingredientId: string) {
  await requireMember();
  await fetchMutation(api.grocery.skip, { ingredientId }, await tokenOpts());
  revalidate();
}

export async function unskipItem(ingredientId: string) {
  await requireMember();
  await fetchMutation(api.grocery.unskip, { ingredientId }, await tokenOpts());
  revalidate();
}

export async function setPantryQuantity(ingredientId: string, quantityG: number) {
  await requireMember();
  const opts = await tokenOpts();
  await fetchMutation(api.pantry.setPantryQuantity, { ingredientId, quantityG }, opts);
  await reconcileSkips(opts);
  revalidate();
}

export async function setRestockOverride(
  ingredientId: string,
  restock?: { quantity: number; unit: string },
) {
  await requireMember();
  await fetchMutation(api.pantry.setRestockOverride, { ingredientId, restock }, await tokenOpts());
  revalidate();
}

// ── Skip reconciliation ───────────────────────────────────────────────────────

/**
 * Clear `skip` rows whose ingredient no longer has a positive plan need (e.g. the
 * recipe was unplanned or the pantry was stocked). Recomputes needs server-side.
 */
async function reconcileSkips(opts: { token?: string }) {
  const [planRows, pantryRows, groceryRows] = await Promise.all([
    fetchQuery(api.plan.plan, {}, opts) as Promise<{ recipeId: string; scale: number }[]>,
    fetchQuery(api.pantry.pantry, {}, opts) as Promise<PantryRow[]>,
    fetchQuery(api.grocery.grocery, {}, opts) as Promise<{ ingredientId: string; source: "manual" | "skip" }[]>,
  ]);
  const skipIds = groceryRows.filter((g) => g.source === "skip").map((g) => g.ingredientId);
  if (skipIds.length === 0) return;

  const docs = (await reader().fetch<RecipeRequirementDoc[]>(RECIPE_REQUIREMENTS_QUERY, {
    ids: planRows.map((p) => p.recipeId),
  })) ?? [];
  const scaleById = new Map(planRows.map((p) => [p.recipeId, p.scale]));
  const all: IngredientRequirement[] = [];
  for (const doc of docs) {
    const lines = doc.lines ?? [];
    const { requirements } = recipeRequirements(toRecipeLines(lines), scaleById.get(doc._id) ?? 1, buildMetaFor(lines));
    all.push(...requirements);
  }
  const needs = computeNeeds(all, buildPantryMap(pantryRows));
  const neededIds = new Set(needs.map((n) => n.ingredientId));
  const stale = skipIds.filter((id) => !neededIds.has(id));
  if (stale.length > 0) {
    await fetchMutation(api.grocery.clearSkips, { ingredientIds: stale }, opts);
  }
}
```

**NOTE for the implementer:** the `markBought` test mocks `fetchQuery` for pantry first (override resolution) then the reconcile's three queries; `reader().fetch` for the ingredient then the reconcile's requirements. If the await ordering in your implementation differs from the test's mock sequence, align the test's `mockResolvedValueOnce` order to the actual call order (the test asserts the mutation calls, which are order-independent via `toHaveBeenCalledWith`). Keep `Date.now()` in `cook` — it runs server-side. The reconcile fetches are acceptable overhead for a personal app.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/app/actions/kitchen-actions.test.ts`
Expected: PASS. Then `npx tsc --noEmit` (clean).

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/kitchen-actions.ts src/app/actions/kitchen-actions.test.ts
git commit -m "feat(2c-2): kitchen loop server actions + skip reconciliation"
```

---

## Task 5: Full gate + `/code-review`

**Files:** none (verification).

- [ ] **Step 1: Run the full gate**

Run: `npm test` then `npm run lint` then `npx tsc --noEmit` then `npx convex dev --once`. Report results — all green expected.

- [ ] **Step 2: `/code-review` the 2c-2 commits and address findings**

Then proceed to the **Spec 2d** plan (migration + review-list). Spec 3 will consume `kitchen-data.ts` (views) + `kitchen-actions.ts` (loop) and do the interactive home-filter rewire.

---

## Self-Review (completed by plan author)

- **Spec coverage (§7):** server-merge orchestration (all tasks); buy→restock-grams→pantry + remove manual (Task 4 `markBought`); cook→deltas via 2b→cook mutation + skip reconcile (Task 4 `cook`); re-need is inherent in computed `getShopData` (Task 3); manual/skip/pantry actions (Task 4); computed plan needs minus pantry, optional-grouping, skip exclusion (Task 3 `getShopData`); quantity-aware cookable coverage (Task 3 `getCookableCoverage`). `requireMember` on every action ✓. Skip auto-clear when need→0 via `reconcileSkips` after cook/removeFromPlan/markBought/setPantryQuantity ✓.
- **Deferred to Spec 3 (per scope note):** the live interactive home-filter rewire, retiring `src/lib/pantry.ts` `filterCookable`, and any rendering. No `page.tsx`/`CollectionView`/`pantry.ts` changes here.
- **Placeholders:** none — full code throughout. Two implementer notes (move a bottom import to the top in Task 3; align mock ordering in Task 4) are clarifications, not gaps.
- **Type consistency:** `RawLine` defined in Task 1 `assemble.ts`, re-exported via `kitchen-queries.ts` (Task 2), consumed by Tasks 3–4. `IngredientRequirement` from Spec 2b flows from `recipeRequirements` → `computeNeeds`/`recipeCoverage`/`depletionDeltas`. `deltasToArray` output `{ingredientId, subtract}[]` matches the 2c-1 `cook` mutation arg. `fetchMutation(api.X, args, {token})` matches the 2c-1 mutation signatures.
- **Testability:** pure helpers (Task 1) fully unit-tested; data/action glue (Tasks 3–4) tested by mocking `@/lib/viewer`, `convex/nextjs`, `@convex-dev/auth/nextjs/server`, and the Sanity client — the established `plan-actions.test.ts` pattern.
