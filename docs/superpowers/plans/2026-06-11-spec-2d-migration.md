# Spec 2d — Migration + review-list Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One-time migration of the global Sanity `mealPlan` document (planned recipes + pantry id-set + free-text manual items) into the founder's per-household Convex records, seeding pantry at restock defaults, and emitting a **review list** the owner goes over — run from a founder-only admin page so it executes as the authenticated owner.

**Architecture:** A founder-gated admin page triggers a server action `runPantryMigration()` that (1) reads the old `mealPlan` from Sanity, (2) seeds `planRecipes` via `api.plan.addToPlan`, (3) seeds `pantryItems` at each ingredient's restock default (`restockToCanonical`) via `api.pantry.setPantryQuantity`, (4) name-matches free-text manual items to the catalog (`api.grocery.addManualItem`), and (5) returns a review list. All seeding reuses the **existing 2c-1 mutations under the owner's auth token** (no new seeding mutation, no admin keys). Idempotent — every mutation upserts. The decision logic is pure + unit-tested; the action is thin glue.

**Tech Stack:** Next.js server action + a founder-gated page, `convex/nextjs` (`fetchMutation`/`fetchQuery`) + `convexAuthNextjsToken`, the `@sanity/client` reader, the `src/lib/kitchen` lib (Spec 2b/2c-2 helpers: `toIngredientInfo`, `restockToCanonical`), `getViewer()` for the owner gate. Vitest with mocks.

**Parent spec:** [docs/superpowers/specs/2026-06-11-cooking-with-june-spec-2-pantry-design.md](../specs/2026-06-11-cooking-with-june-spec-2-pantry-design.md) §5 (migration) + §8.

**Migration mechanism (approved):** founder-only admin page (`/admin/migrate`), run while logged in so the server action carries the owner's Convex token and seeds the owner's household via `requireMembership`. The page is removed/disabled after the one-time run.

**Source data (old global `mealPlan` doc):** `recipes[]` (refs), `recipeScales[]` (`{_key=recipeId, scale}`), `pantryIngredients` (string id array), `manualItems[]` (`{name, location}` free-text). Grocery id-set is NOT migrated (needs are computed). Owner-gate: `getViewer().role === "owner"`.

---

## File Structure

- `src/sanity/lib/migration-queries.ts` — **create**: GROQ for the old mealPlan source + a batch ingredient-metadata query + a catalog name list.
- `src/lib/kitchen/migrate.ts` + `migrate.test.ts` — **create**: pure migration logic (plan seed, pantry seed + skip classification, manual name-match).
- `src/app/actions/migrate-actions.ts` + `migrate-actions.test.ts` — **create**: `runPantryMigration()` owner-gated orchestration → review list.
- `src/app/(site)/admin/migrate/page.tsx` + `src/components/migrate-runner.tsx` — **create**: founder-gated page + a client button that runs the action and renders the review list.

Pure logic in `migrate.ts` (tested); the action is glue (tested with mocks); the page is thin UI.

---

## Task 1: Migration GROQ queries

**Files:**
- Create: `src/sanity/lib/migration-queries.ts`

- [ ] **Step 1: Implement**

`src/sanity/lib/migration-queries.ts`:

```ts
import { defineQuery } from "next-sanity";
import type { RawLine } from "@/lib/kitchen/assemble";

/** The old global mealPlan: planned recipe ids + scales, pantry id-set, manual items. */
export const MIGRATION_SOURCE_QUERY = defineQuery(`
  *[_id == "mealPlan"][0]{
    "recipeIds": recipes[]._ref,
    "recipeScales": recipeScales[]{ "recipeId": _key, scale },
    pantryIngredients,
    "manualItems": manualItems[]{ name }
  }
`);

/** Stock metadata for a batch of ingredient ids (for pantry seeding). */
export const INGREDIENTS_BY_IDS_QUERY = defineQuery(`
  *[_type == "ingredient" && _id in $ids]{
    "ingredientId": _id,
    name,
    canonicalUnitKind,
    density,
    avgUnitGrams,
    category,
    restockQuantity
  }
`);

/** All catalog ingredient ids + names (for matching free-text manual items). */
export const INGREDIENT_NAMES_QUERY = defineQuery(`
  *[_type == "ingredient"]{ "ingredientId": _id, name }
`);

export type MigrationSource = {
  recipeIds: string[] | null;
  recipeScales: { recipeId: string; scale: number | null }[] | null;
  pantryIngredients: string[] | null;
  manualItems: { name: string }[] | null;
};

export type IngredientMetaDoc = RawLine; // shares the ingredientId/name/metadata shape
export type CatalogNameRow = { ingredientId: string; name: string };
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (clean) and `npm run lint` (clean).

```bash
git add src/sanity/lib/migration-queries.ts
git commit -m "feat(2d): migration source + ingredient-batch GROQ"
```

---

## Task 2: Pure migration logic

**Files:**
- Create: `src/lib/kitchen/migrate.ts`
- Test: `src/lib/kitchen/migrate.test.ts`

Pure functions that turn the source data into seed instructions + the review list, reusing `toIngredientInfo` + `restockToCanonical`.

- [ ] **Step 1: Write the failing test**

`src/lib/kitchen/migrate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  planSeed,
  pantrySeed,
  matchManualItems,
} from "@/lib/kitchen/migrate";
import type { RawLine } from "@/lib/kitchen/assemble";

describe("planSeed", () => {
  it("pairs each recipe id with its scale, defaulting to 1", () => {
    const seed = planSeed(["r1", "r2"], [{ recipeId: "r1", scale: 3 }]);
    expect(seed).toEqual([
      { recipeId: "r1", scale: 3 },
      { recipeId: "r2", scale: 1 },
    ]);
  });

  it("handles missing/empty inputs", () => {
    expect(planSeed(null, null)).toEqual([]);
  });
});

const beef: RawLine = {
  ingredientId: "beef", name: "ground beef", canonicalUnitKind: "mass",
  density: null, avgUnitGrams: null, category: "protein",
  restockQuantity: { quantity: 1, unit: "kg" },
};
const egg: RawLine = {
  ingredientId: "egg", name: "egg", canonicalUnitKind: "count",
  density: null, avgUnitGrams: 50, category: "produce",
  restockQuantity: { quantity: 12, unit: "" },
};
const unenriched: RawLine = {
  ingredientId: "mystery", name: "unobtainium", canonicalUnitKind: null,
  density: null, avgUnitGrams: null, category: null, restockQuantity: null,
};
const noRestock: RawLine = {
  ingredientId: "salt", name: "salt", canonicalUnitKind: "mass",
  density: null, avgUnitGrams: null, category: "spice", restockQuantity: null,
};

describe("pantrySeed", () => {
  it("seeds each pantry ingredient at its restock default in canonical units", () => {
    const { seed, skipped } = pantrySeed([beef, egg]);
    expect(seed).toEqual([
      { ingredientId: "beef", name: "ground beef", quantityG: 1000, canonicalUnitKind: "mass" },
      { ingredientId: "egg", name: "egg", quantityG: 12, canonicalUnitKind: "count" },
    ]);
    expect(skipped).toEqual([]);
  });

  it("reports un-enriched and no-restock ingredients as skipped, not seeded", () => {
    const { seed, skipped } = pantrySeed([unenriched, noRestock]);
    expect(seed).toEqual([]);
    expect(skipped.map((s) => s.ingredientId)).toEqual(["mystery", "salt"]);
    expect(skipped[0].reason).toMatch(/metadata/i);
    expect(skipped[1].reason).toMatch(/restock/i);
  });
});

describe("matchManualItems", () => {
  it("matches free-text names to the catalog case-insensitively", () => {
    const catalog = [
      { ingredientId: "i1", name: "Paper Towels" },
      { ingredientId: "i2", name: "Olive Oil" },
    ];
    const { matched, unmapped } = matchManualItems(
      [{ name: "paper towels" }, { name: "grandma's sauce" }],
      catalog,
    );
    expect(matched).toEqual([{ name: "paper towels", ingredientId: "i1" }]);
    expect(unmapped).toEqual(["grandma's sauce"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/kitchen/migrate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/kitchen/migrate.ts`:

```ts
import { toIngredientInfo, restockToCanonical, type RawLine } from "@/lib/kitchen/assemble";
import type { CanonicalUnitKind } from "@/lib/enrichment/types";

export type PlanSeedRow = { recipeId: string; scale: number };
export type PantrySeedRow = {
  ingredientId: string;
  name: string;
  quantityG: number;
  canonicalUnitKind: CanonicalUnitKind;
};
export type SkippedIngredient = { ingredientId: string; name: string; reason: string };
export type ManualMatch = { name: string; ingredientId: string };

/** Pair each planned recipe id with its scale (default 1). */
export function planSeed(
  recipeIds: string[] | null | undefined,
  recipeScales: { recipeId: string; scale: number | null }[] | null | undefined,
): PlanSeedRow[] {
  const scaleById = new Map((recipeScales ?? []).map((s) => [s.recipeId, s.scale]));
  return (recipeIds ?? []).map((recipeId) => {
    const s = scaleById.get(recipeId);
    return { recipeId, scale: typeof s === "number" && s > 0 ? s : 1 };
  });
}

/**
 * Seed each pantry ingredient at its restock default, converted to canonical
 * units. Un-enriched ingredients and ones without a usable restock are reported
 * as `skipped` (for the review list), never silently dropped.
 */
export function pantrySeed(docs: RawLine[]): {
  seed: PantrySeedRow[];
  skipped: SkippedIngredient[];
} {
  const seed: PantrySeedRow[] = [];
  const skipped: SkippedIngredient[] = [];
  for (const doc of docs) {
    const info = toIngredientInfo(doc);
    if (!info) {
      skipped.push({ ingredientId: doc.ingredientId, name: doc.name, reason: "no stock metadata" });
      continue;
    }
    const grams = restockToCanonical(doc.restockQuantity, info, doc.name);
    if (grams == null || grams <= 0) {
      skipped.push({ ingredientId: doc.ingredientId, name: doc.name, reason: "no usable restock quantity" });
      continue;
    }
    seed.push({
      ingredientId: doc.ingredientId,
      name: doc.name,
      quantityG: grams,
      canonicalUnitKind: info.canonicalUnitKind,
    });
  }
  return { seed, skipped };
}

/** Match free-text manual items to the catalog by lowercased name. */
export function matchManualItems(
  items: { name: string }[],
  catalog: { ingredientId: string; name: string }[],
): { matched: ManualMatch[]; unmapped: string[] } {
  const byName = new Map(catalog.map((c) => [c.name.trim().toLowerCase(), c.ingredientId]));
  const matched: ManualMatch[] = [];
  const unmapped: string[] = [];
  for (const item of items) {
    const id = byName.get(item.name.trim().toLowerCase());
    if (id) matched.push({ name: item.name, ingredientId: id });
    else unmapped.push(item.name);
  }
  return { matched, unmapped };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/lib/kitchen/migrate.test.ts`
Expected: PASS. Then `npx tsc --noEmit` (clean).

- [ ] **Step 5: Commit**

```bash
git add src/lib/kitchen/migrate.ts src/lib/kitchen/migrate.test.ts
git commit -m "feat(2d): pure migration logic (plan/pantry seed + manual match)"
```

---

## Task 3: The migration server action

**Files:**
- Create: `src/app/actions/migrate-actions.ts`
- Test: `src/app/actions/migrate-actions.test.ts`

`runPantryMigration()` — owner-gated; reads the source, seeds via the existing mutations under the owner's token, returns the review list. Idempotent.

- [ ] **Step 1: Write the failing test**

`src/app/actions/migrate-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/viewer", () => ({ getViewer: vi.fn() }));
vi.mock("@convex-dev/auth/nextjs/server", () => ({
  convexAuthNextjsToken: vi.fn().mockResolvedValue("tok"),
}));
const fetchMutation = vi.fn().mockResolvedValue(undefined);
vi.mock("convex/nextjs", () => ({ fetchMutation: (...a: unknown[]) => fetchMutation(...a) }));
const sanityFetch = vi.fn();
vi.mock("@/sanity/lib/client", () => ({
  client: { withConfig: () => ({ fetch: (...a: unknown[]) => sanityFetch(...a) }) },
}));

import { getViewer } from "@/lib/viewer";
import { api } from "@cvx/_generated/api";
import { runPantryMigration } from "@/app/actions/migrate-actions";

const OWNER = { isAuthenticated: true, isMember: true, userId: "u1", householdId: "h1", role: "owner", name: "F", canCreateHousehold: false };

beforeEach(() => {
  vi.mocked(getViewer).mockResolvedValue(OWNER as never);
  fetchMutation.mockClear();
  sanityFetch.mockReset();
});

function mockSanity() {
  sanityFetch.mockImplementation((q: unknown, params: unknown) => {
    const p = params as { ids?: string[] } | undefined;
    if (p?.ids) {
      // INGREDIENTS_BY_IDS_QUERY
      return Promise.resolve([
        { ingredientId: "beef", name: "ground beef", canonicalUnitKind: "mass",
          density: null, avgUnitGrams: null, category: "protein", restockQuantity: { quantity: 1, unit: "kg" } },
      ]);
    }
    if (q && String(q).includes("mealPlan")) {
      return Promise.resolve({
        recipeIds: ["r1"],
        recipeScales: [{ recipeId: "r1", scale: 2 }],
        pantryIngredients: ["beef"],
        manualItems: [{ name: "paper towels" }, { name: "grandma sauce" }],
      });
    }
    // INGREDIENT_NAMES_QUERY
    return Promise.resolve([{ ingredientId: "pt", name: "Paper Towels" }]);
  });
}

describe("runPantryMigration", () => {
  it("rejects a non-owner", async () => {
    vi.mocked(getViewer).mockResolvedValue({ ...OWNER, role: "member" } as never);
    await expect(runPantryMigration()).rejects.toThrow(/owner/i);
  });

  it("seeds plan + pantry + matched manual and returns a review list", async () => {
    mockSanity();
    const review = await runPantryMigration();

    expect(fetchMutation).toHaveBeenCalledWith(api.plan.addToPlan, { recipeId: "r1", scale: 2 }, { token: "tok" });
    expect(fetchMutation).toHaveBeenCalledWith(api.pantry.setPantryQuantity, { ingredientId: "beef", quantityG: 1000 }, { token: "tok" });
    expect(fetchMutation).toHaveBeenCalledWith(api.grocery.addManualItem, { ingredientId: "pt" }, { token: "tok" });

    expect(review.seededPlan).toEqual([{ recipeId: "r1", scale: 2 }]);
    expect(review.seededPantry).toEqual([
      { ingredientId: "beef", name: "ground beef", quantityG: 1000, canonicalUnitKind: "mass" },
    ]);
    expect(review.unmappedManual).toEqual(["grandma sauce"]);
    expect(review.skippedPantry).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/app/actions/migrate-actions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/app/actions/migrate-actions.ts`:

```ts
"use server";

import { fetchMutation } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@cvx/_generated/api";
import { client } from "@/sanity/lib/client";
import { getViewer } from "@/lib/viewer";
import {
  MIGRATION_SOURCE_QUERY,
  INGREDIENTS_BY_IDS_QUERY,
  INGREDIENT_NAMES_QUERY,
  type MigrationSource,
  type IngredientMetaDoc,
  type CatalogNameRow,
} from "@/sanity/lib/migration-queries";
import { planSeed, pantrySeed, matchManualItems } from "@/lib/kitchen/migrate";

const reader = () => client.withConfig({ useCdn: false });

export type MigrationReview = {
  seededPlan: { recipeId: string; scale: number }[];
  seededPantry: { ingredientId: string; name: string; quantityG: number; canonicalUnitKind: string }[];
  skippedPantry: { ingredientId: string; name: string; reason: string }[];
  matchedManual: { name: string; ingredientId: string }[];
  unmappedManual: string[];
};

export async function runPantryMigration(): Promise<MigrationReview> {
  const viewer = await getViewer();
  if (viewer.role !== "owner") {
    throw new Error("Only the household owner can run the migration");
  }
  const token = await convexAuthNextjsToken();
  const opts = token ? { token } : {};

  const source = (await reader().fetch<MigrationSource>(MIGRATION_SOURCE_QUERY)) ?? {
    recipeIds: [],
    recipeScales: [],
    pantryIngredients: [],
    manualItems: [],
  };

  // ── Plan ────────────────────────────────────────────────
  const plan = planSeed(source.recipeIds, source.recipeScales);
  for (const p of plan) {
    await fetchMutation(api.plan.addToPlan, { recipeId: p.recipeId, scale: p.scale }, opts);
  }

  // ── Pantry (seed at restock defaults) ───────────────────
  const pantryIds = source.pantryIngredients ?? [];
  const docs = pantryIds.length
    ? (await reader().fetch<IngredientMetaDoc[]>(INGREDIENTS_BY_IDS_QUERY, { ids: pantryIds })) ?? []
    : [];
  const { seed: pantry, skipped: skippedPantry } = pantrySeed(docs);
  for (const item of pantry) {
    await fetchMutation(
      api.pantry.setPantryQuantity,
      { ingredientId: item.ingredientId, quantityG: item.quantityG },
      opts,
    );
  }

  // ── Manual items (name-match to catalog) ────────────────
  const manualItems = source.manualItems ?? [];
  const catalog = manualItems.length
    ? (await reader().fetch<CatalogNameRow[]>(INGREDIENT_NAMES_QUERY)) ?? []
    : [];
  const { matched, unmapped: unmappedManual } = matchManualItems(manualItems, catalog);
  for (const m of matched) {
    await fetchMutation(api.grocery.addManualItem, { ingredientId: m.ingredientId }, opts);
  }

  return {
    seededPlan: plan,
    seededPantry: pantry,
    skippedPantry,
    matchedManual: matched,
    unmappedManual,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/app/actions/migrate-actions.test.ts`
Expected: PASS. Then `npx tsc --noEmit` (clean) and `npm run lint` (clean).

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/migrate-actions.ts src/app/actions/migrate-actions.test.ts
git commit -m "feat(2d): owner-gated migration action -> review list"
```

---

## Task 4: Founder-gated admin page + runner

**Files:**
- Create: `src/components/migrate-runner.tsx`
- Create: `src/app/(site)/admin/migrate/page.tsx`

The page gates on the owner role server-side; the client runner triggers the action and renders the review list.

- [ ] **Step 1: Implement the client runner**

`src/components/migrate-runner.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { runPantryMigration, type MigrationReview } from "@/app/actions/migrate-actions";

export function MigrateRunner() {
  const [review, setReview] = useState<MigrationReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      try {
        setReview(await runPantryMigration());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Migration failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      <button
        onClick={run}
        disabled={pending}
        className="kicker rounded-full border border-terracotta px-4 py-2 text-terracotta hover:bg-terracotta hover:text-paper disabled:opacity-50"
      >
        {pending ? "Migrating…" : "Run migration"}
      </button>
      {error ? <p className="text-red-600">{error}</p> : null}
      {review ? (
        <div className="space-y-3 text-sm">
          <p>Seeded {review.seededPlan.length} planned recipes.</p>
          <div>
            <p className="font-semibold">Seeded pantry ({review.seededPantry.length}):</p>
            <ul className="list-disc pl-5">
              {review.seededPantry.map((p) => (
                <li key={p.ingredientId}>
                  {p.name} — {p.quantityG} {p.canonicalUnitKind === "count" ? "ct" : "g"}
                </li>
              ))}
            </ul>
          </div>
          {review.skippedPantry.length ? (
            <div>
              <p className="font-semibold">Skipped pantry (fix in Studio):</p>
              <ul className="list-disc pl-5">
                {review.skippedPantry.map((s) => (
                  <li key={s.ingredientId}>{s.name} — {s.reason}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {review.unmappedManual.length ? (
            <div>
              <p className="font-semibold">Unmapped manual items (re-add via catalog):</p>
              <ul className="list-disc pl-5">
                {review.unmappedManual.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Implement the gated page**

`src/app/(site)/admin/migrate/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { MigrateRunner } from "@/components/migrate-runner";

export default async function MigratePage() {
  const viewer = await getViewer();
  if (viewer.role !== "owner") notFound();

  return (
    <section className="mx-auto max-w-2xl py-8">
      <h1 className="editorial-display text-3xl text-ink">Migrate plan & pantry</h1>
      <p className="editorial-aside mt-2 text-ink-soft">
        One-time: move the old global plan into your household. Seeds pantry at
        restock defaults — review and correct quantities afterward in the Pantry.
      </p>
      <div className="mt-6">
        <MigrateRunner />
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Typecheck / lint / build-sanity**

Run: `npx tsc --noEmit` (clean), `npm run lint` (clean), and `npm test` (full suite still green — no test for the page/runner; they are thin UI verified manually in Task 5).

- [ ] **Step 4: Commit**

```bash
git add src/components/migrate-runner.tsx "src/app/(site)/admin/migrate/page.tsx"
git commit -m "feat(2d): founder-gated /admin/migrate page + review-list runner"
```

---

## Task 5: Owner runs the migration + reviews (owner-gated)

**Files:** none (operational).

- [ ] **Step 1: Run the dev app + visit the page**

The owner runs the app (`npm run dev`), signs in, and visits `/admin/migrate`. (Non-owners get a 404.)

- [ ] **Step 2: Run the migration**

Click **Run migration**. Review the rendered list: seeded planned recipes, seeded pantry (name + assumed quantity), skipped pantry (un-enriched / no restock — fix in Studio), and unmapped manual items (re-add via catalog later).

- [ ] **Step 3: Owner corrections**

The owner hands back any pantry quantities to adjust; apply them via `api.pantry.setPantryQuantity` (or the Pantry UI once Spec 3 lands). It is safe to re-run the migration — every mutation upserts (idempotent).

- [ ] **Step 4: Disable the admin route**

After a successful run, remove (or comment-gate behind an env flag) `src/app/(site)/admin/migrate/page.tsx` + `migrate-runner.tsx` so the one-time tool isn't left in the app. (The migration action + pure logic can stay, unused.) Commit the removal.

- [ ] **Step 5: Full gate + `/code-review`**

Run `npm test`, `npm run lint`, `npx tsc --noEmit`, `npx convex dev --once`. Report results. `/code-review` the 2d commits and address findings.

**This completes Spec 2.** Spec 3 (UX) consumes the 2c-2 read API + actions and builds the Plan/Shop/Pantry UI + the interactive cookable rewire.

---

## Self-Review (completed by plan author)

- **Spec coverage (§5 migration):** planned recipes → `planRecipes` with scale (Task 2/3 `planSeed`); pantry ids → `pantryItems` seeded at restock defaults via `restockToCanonical` (Task 2/3 `pantrySeed`); grocery id-set NOT migrated (computed); free-text manual items name-matched, unmatched reported (Task 2/3 `matchManualItems`); review list emitted + rendered (Task 3/4); idempotent via upserting mutations; owner-gated + run-as-founder (Task 3 `getViewer().role` + token). ✓
- **Placeholders:** none — full code throughout.
- **Type consistency:** `RawLine` (from `assemble.ts`) reused as `IngredientMetaDoc`; `planSeed`/`pantrySeed`/`matchManualItems` outputs feed the action's `fetchMutation` args + the `MigrationReview` shape consumed by the runner component. The action calls only existing 2c-1 mutations (`api.plan.addToPlan`, `api.pantry.setPantryQuantity`, `api.grocery.addManualItem`).
- **Testing:** pure logic (Task 2) fully unit-tested incl. skip-classification + case-insensitive match; the action (Task 3) tested with mocks incl. the owner gate; the page/runner (Task 4) are thin UI verified manually in Task 5.
- **Owner-operational:** Task 5 is the owner's run + review + route removal, mirroring the 2a enrichment hand-off.
