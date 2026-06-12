# Spec 3a — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared foundation the three Spec 3 views sit on — a batch ingredient-catalog query folded into the read API, one shared enriched-ingredient create helper used by both Shop and the recipe form, and the Kitchen header entry + `Menu | Shop | Pantry` sub-nav + route stubs (with the Plan→Menu rename).

**Architecture:** Sanity holds immutable catalog content; Convex holds mutable per-household state. The read API in `src/app/actions/kitchen-data.ts` already assembles plan/pantry/shop data; this plan adds a `INGREDIENTS_BY_IDS_QUERY` GROQ query and folds catalog display fields (name, `canonicalUnitKind`, category, restock default) into `getPantryData()` and `getShopData()`'s manual rows. A new server-only helper `getOrCreateEnrichedIngredient(name)` looks up a catalog ingredient by lower-cased name and, when missing, enriches it via the existing `src/lib/enrichment` machinery (Haiku default / Sonnet fallback) before creating it — replacing the current bare-create in `recipe-actions.ts`. Nav: the existing members-only "Plan" link (in `auth-controls.tsx`) becomes the "Kitchen" umbrella pointing at `/menu`; a new `KitchenSubnav` segmented control renders on `/menu`, `/shop`, `/pantry` stub pages.

**Tech Stack:** Next.js 16 (App Router, server actions), Sanity (`next-sanity` GROQ + write client), Convex (read via `fetchQuery`), `@anthropic-ai/sdk` (already wired in `src/lib/enrichment/client.ts`), Vitest + Testing Library.

---

## File Structure

**Create:**
- `src/lib/ingredients/get-or-create.ts` — server-only `getOrCreateEnrichedIngredient(name)` helper (lookup-or-enrich-and-create).
- `src/lib/ingredients/get-or-create.test.ts` — unit tests (reuse vs create vs enrichment-failure fallback).
- `src/components/kitchen-subnav.tsx` — segmented `Menu | Shop | Pantry` sub-nav (client).
- `src/components/kitchen-subnav.test.tsx` — active-state behavior test.
- `src/app/(site)/menu/page.tsx`, `src/app/(site)/shop/page.tsx`, `src/app/(site)/pantry/page.tsx` — member-gated stub pages rendering `KitchenSubnav` + a placeholder (replaced by real views in 3b–3d).

**Modify:**
- `src/sanity/lib/kitchen-queries.ts` — add `INGREDIENTS_BY_IDS_QUERY` + `CatalogInfoDoc` type.
- `src/app/actions/kitchen-data.ts` — add `catalogInfoByIds` helper; fold catalog fields into `getPantryData()` and `getShopData()`.
- `src/app/actions/kitchen-data.test.ts` — assert the new fields.
- `src/app/actions/recipe-actions.ts` — replace `resolveIngredientId` bare-create with `getOrCreateEnrichedIngredient`.
- `src/app/actions/recipe-actions.test.ts` — mock the new helper.
- `src/components/auth-controls.tsx` — rename the "Plan"→`/plan` link to "Kitchen"→`/menu`.
- `src/components/auth-controls.test.tsx` — update the link-name assertions.

**Do NOT touch in 3a** (later sub-plans): `plan-view.tsx`, `plan-actions.ts`, `/plan/page.tsx` (retired in 3d), `collection-view.tsx`/`recipe-filter.ts` (3e), `src/lib/pantry.ts` (3e).

---

## Task 1: Batch catalog query + fold into `getPantryData`

**Files:**
- Modify: `src/sanity/lib/kitchen-queries.ts`
- Modify: `src/app/actions/kitchen-data.ts`
- Test: `src/app/actions/kitchen-data.test.ts`

- [ ] **Step 1: Add the query + type to `kitchen-queries.ts`**

Append to `src/sanity/lib/kitchen-queries.ts` (after `INGREDIENT_RESTOCK_QUERY`):

```ts
/**
 * Display + unit metadata for a set of catalog ingredients, keyed lookups for
 * pantry rows and manual grocery rows (which only carry an ingredientId).
 */
export const INGREDIENTS_BY_IDS_QUERY = defineQuery(`
  *[_type == "ingredient" && _id in $ids]{
    _id,
    name,
    canonicalUnitKind,
    category,
    restockQuantity
  }
`);

export type CatalogInfoDoc = {
  _id: string;
  name: string;
  canonicalUnitKind: "mass" | "volume" | "count" | null;
  category: string | null;
  restockQuantity: { quantity: number; unit: string } | null;
};
```

- [ ] **Step 2: Write the failing test for `getPantryData`**

In `src/app/actions/kitchen-data.test.ts`, add `getPantryData` to the existing import line:

```ts
import { getShopData, getCookableCoverage, getPlanData, getPantryData } from "@/app/actions/kitchen-data";
```

Add this suite at the end of the file:

```ts
describe("getPantryData", () => {
  it("joins catalog name, unit kind, and restock default onto each pantry row", async () => {
    fetchQuery.mockResolvedValueOnce([
      { ingredientId: "beef", quantityG: 200, restockOverride: null, updatedAt: 1 },
      { ingredientId: "egg", quantityG: 4.8, restockOverride: { quantity: 1, unit: "dozen" }, updatedAt: 2 },
    ]); // pantry
    sanityFetch.mockResolvedValueOnce([
      { _id: "beef", name: "ground beef", canonicalUnitKind: "mass", category: "protein", restockQuantity: { quantity: 1, unit: "lb" } },
      { _id: "egg", name: "egg", canonicalUnitKind: "count", category: "protein", restockQuantity: { quantity: 12, unit: "" } },
    ]); // catalog

    const rows = await getPantryData();
    const beef = rows.find((r) => r.ingredientId === "beef");
    expect(beef).toMatchObject({
      quantityG: 200,
      name: "ground beef",
      canonicalUnitKind: "mass",
      restockDefault: { quantity: 1, unit: "lb" },
    });
    const egg = rows.find((r) => r.ingredientId === "egg");
    expect(egg?.name).toBe("egg");
    expect(egg?.canonicalUnitKind).toBe("count");
  });

  it("falls back to the id as name when the catalog has no match", async () => {
    fetchQuery.mockResolvedValueOnce([
      { ingredientId: "ghost", quantityG: 50, restockOverride: null, updatedAt: 1 },
    ]);
    sanityFetch.mockResolvedValueOnce([]);
    const rows = await getPantryData();
    expect(rows[0]).toMatchObject({ ingredientId: "ghost", name: "ghost", canonicalUnitKind: null });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/app/actions/kitchen-data.test.ts -t "getPantryData"`
Expected: FAIL — current `getPantryData` returns raw Convex rows with no `name`/`canonicalUnitKind`/`restockDefault`.

- [ ] **Step 4: Implement the catalog helper + reshape `getPantryData`**

In `src/app/actions/kitchen-data.ts`, extend the kitchen-queries import:

```ts
import {
  RECIPE_REQUIREMENTS_QUERY,
  INGREDIENTS_BY_IDS_QUERY,
  type RecipeRequirementDoc,
  type CatalogInfoDoc,
} from "@/sanity/lib/kitchen-queries";
```

Add this helper below `fetchRequirements`:

```ts
async function catalogInfoByIds(ids: string[]): Promise<Map<string, CatalogInfoDoc>> {
  if (ids.length === 0) return new Map();
  const docs = (await reader().fetch<CatalogInfoDoc[]>(INGREDIENTS_BY_IDS_QUERY, { ids })) ?? [];
  return new Map(docs.map((d) => [d._id, d]));
}
```

Replace the existing `getPantryData` (the `PantryRow` type stays):

```ts
type PantryRow = {
  ingredientId: string;
  quantityG: number;
  restockOverride: { quantity: number; unit: string } | null;
  updatedAt: number;
};

export async function getPantryData() {
  await requireMember();
  const token = await convexAuthNextjsToken();
  const rows = (await fetchQuery(api.pantry.pantry, {}, token ? { token } : {})) as PantryRow[];
  const info = await catalogInfoByIds(rows.map((r) => r.ingredientId));
  return rows.map((r) => {
    const c = info.get(r.ingredientId);
    return {
      ingredientId: r.ingredientId,
      quantityG: r.quantityG,
      restockOverride: r.restockOverride,
      updatedAt: r.updatedAt,
      name: c?.name ?? r.ingredientId,
      canonicalUnitKind: c?.canonicalUnitKind ?? null,
      category: c?.category ?? null,
      restockDefault: c?.restockQuantity ?? null,
    };
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/app/actions/kitchen-data.test.ts -t "getPantryData"`
Expected: PASS (both cases).

- [ ] **Step 6: Run the whole kitchen-data suite (no regressions)**

Run: `npx vitest run src/app/actions/kitchen-data.test.ts`
Expected: PASS — existing `getShopData`/`getCookableCoverage`/`getPlanData` tests still green (the shared `PantryRow` type now includes `restockOverride`/`updatedAt`, which those mocks already provide).

- [ ] **Step 7: Commit**

```bash
git add src/sanity/lib/kitchen-queries.ts src/app/actions/kitchen-data.ts src/app/actions/kitchen-data.test.ts
git commit -m "feat(3a): batch catalog query folded into getPantryData (name/unit/restock)"
```

---

## Task 2: Fold catalog info into `getShopData` manual rows

**Files:**
- Modify: `src/app/actions/kitchen-data.ts`
- Test: `src/app/actions/kitchen-data.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the `describe("getShopData", ...)` block in `src/app/actions/kitchen-data.test.ts`:

```ts
it("enriches manual rows with catalog name, unit kind, and category", async () => {
  fetchQuery
    .mockResolvedValueOnce([]) // plan (no recipes → no needs)
    .mockResolvedValueOnce([]) // pantry
    .mockResolvedValueOnce([
      { ingredientId: "salt", source: "manual", manualQuantity: { quantity: 1, unit: "box" } },
    ]); // grocery
  sanityFetch
    .mockResolvedValueOnce([]) // requirements (no planned recipes)
    .mockResolvedValueOnce([
      { _id: "salt", name: "table salt", canonicalUnitKind: "mass", category: "spice", restockQuantity: null },
    ]); // catalog-by-ids for manual rows

  const data = await getShopData();
  expect(data.manual[0]).toMatchObject({
    ingredientId: "salt",
    name: "table salt",
    canonicalUnitKind: "mass",
    category: "spice",
    manualQuantity: { quantity: 1, unit: "box" },
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/actions/kitchen-data.test.ts -t "enriches manual rows"`
Expected: FAIL — manual rows currently have only `ingredientId`/`source`/`manualQuantity`.

- [ ] **Step 3: Implement the reshape in `getShopData`**

In `src/app/actions/kitchen-data.ts`, replace the final two lines of `getShopData` (the `const manual = ...` line and the `return ...`) with:

```ts
  const manualRows = groceryRows.filter((g) => g.source === "manual");
  const manualInfo = await catalogInfoByIds(manualRows.map((m) => m.ingredientId));
  const manual = manualRows.map((m) => {
    const c = manualInfo.get(m.ingredientId);
    return {
      ingredientId: m.ingredientId,
      source: m.source,
      manualQuantity: m.manualQuantity,
      name: c?.name ?? m.ingredientId,
      canonicalUnitKind: c?.canonicalUnitKind ?? null,
      category: c?.category ?? null,
    };
  });
  return { needs, manual, skipped };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/actions/kitchen-data.test.ts -t "enriches manual rows"`
Expected: PASS.

- [ ] **Step 5: Run the whole kitchen-data suite + typecheck**

Run: `npx vitest run src/app/actions/kitchen-data.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors. (The pre-existing `getShopData` test has a manual "salt" row, so after this change it triggers a second `sanityFetch` for `catalogInfoByIds` that the test doesn't mock — it resolves `undefined`, which `?? []` turns into an empty map, so salt falls back to `name: "salt"`. That test only asserts `ingredientId`, so it stays green.)

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/kitchen-data.ts src/app/actions/kitchen-data.test.ts
git commit -m "feat(3a): fold catalog name/unit/category into getShopData manual rows"
```

---

## Task 3: `getOrCreateEnrichedIngredient` helper

**Files:**
- Create: `src/lib/ingredients/get-or-create.ts`
- Test: `src/lib/ingredients/get-or-create.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/ingredients/get-or-create.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const sanityFetch = vi.fn();
vi.mock("@/sanity/lib/client", () => ({
  client: { withConfig: () => ({ fetch: (...a: unknown[]) => sanityFetch(...a) }) },
}));
const create = vi.fn();
vi.mock("@/sanity/lib/write-client", () => ({
  getWriteClient: () => ({ create: (...a: unknown[]) => create(...a) }),
}));
const enrichBatch = vi.fn();
vi.mock("@/lib/enrichment/client", () => ({
  enrichBatch: (...a: unknown[]) => enrichBatch(...a),
}));

import { getOrCreateEnrichedIngredient } from "@/lib/ingredients/get-or-create";

beforeEach(() => {
  sanityFetch.mockReset();
  create.mockReset();
  enrichBatch.mockReset();
  create.mockResolvedValue({ _id: "new-id" });
});

describe("getOrCreateEnrichedIngredient", () => {
  it("returns the existing id without enriching when a name match exists", async () => {
    sanityFetch.mockResolvedValueOnce({ _id: "existing-id" });
    const id = await getOrCreateEnrichedIngredient("Ground Beef");
    expect(id).toBe("existing-id");
    expect(enrichBatch).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("enriches and creates with full stock metadata when missing", async () => {
    sanityFetch.mockResolvedValueOnce(null);
    enrichBatch.mockResolvedValueOnce([
      {
        name: "havarti",
        canonicalUnitKind: "mass",
        category: "dairy",
        restockQuantity: { quantity: 200, unit: "g" },
      },
    ]);
    const id = await getOrCreateEnrichedIngredient("Havarti");
    expect(id).toBe("new-id");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        _type: "ingredient",
        name: "Havarti",
        canonicalUnitKind: "mass",
        category: "dairy",
        restockQuantity: { quantity: 200, unit: "g" },
      }),
    );
  });

  it("creates a minimal (flagged) ingredient when enrichment throws", async () => {
    sanityFetch.mockResolvedValueOnce(null);
    enrichBatch.mockRejectedValueOnce(new Error("api down"));
    const id = await getOrCreateEnrichedIngredient("Mystery Item");
    expect(id).toBe("new-id");
    const doc = create.mock.calls[0][0] as Record<string, unknown>;
    expect(doc._type).toBe("ingredient");
    expect(doc.name).toBe("Mystery Item");
    // No category/restock → the batch enrich script will pick it up later.
    expect(doc.category).toBeUndefined();
  });

  it("rejects an empty name", async () => {
    await expect(getOrCreateEnrichedIngredient("  ")).rejects.toThrow("Ingredient name required");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/ingredients/get-or-create.test.ts`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Implement the helper**

Create `src/lib/ingredients/get-or-create.ts`:

```ts
import { client } from "@/sanity/lib/client";
import { getWriteClient } from "@/sanity/lib/write-client";
import { enrichBatch } from "@/lib/enrichment/client";
import { validateEnrichmentResult } from "@/lib/enrichment/validate";
import { fallbackMetadata } from "@/lib/enrichment/fallback";

const reader = () => client.withConfig({ useCdn: false });

/**
 * Resolve a catalog ingredient id for `name`, creating it if missing. New
 * ingredients are enriched with full stock metadata (canonicalUnitKind, density/
 * avgUnitGrams, category, restockQuantity) via Claude so the catalog stays
 * consistent with depletion math. If enrichment is unreachable or unusable, the
 * ingredient is created with name + any heuristic hint only — left without
 * category/restock so the batch `enrich:ingredients` script flags + completes it
 * later. Adding an item never hard-fails on enrichment.
 *
 * Server-only (imports the Sanity write client + Anthropic SDK).
 */
export async function getOrCreateEnrichedIngredient(name: string): Promise<string> {
  const clean = name.trim();
  if (!clean) throw new Error("Ingredient name required");

  const existing = await reader().fetch<{ _id: string } | null>(
    `*[_type == "ingredient" && lower(name) == lower($name)][0]{ _id }`,
    { name: clean },
  );
  if (existing?._id) return existing._id;

  const created = await getWriteClient().create(await buildNewIngredientDoc(clean));
  return created._id;
}

async function buildNewIngredientDoc(name: string): Promise<Record<string, unknown>> {
  try {
    const [raw] = await enrichBatch([name]);
    const result = validateEnrichmentResult(raw);
    if (result.ok) {
      const m = result.value;
      return {
        _type: "ingredient",
        name,
        canonicalUnitKind: m.canonicalUnitKind,
        density: m.density,
        avgUnitGrams: m.avgUnitGrams,
        category: m.category,
        restockQuantity: m.restockQuantity,
      };
    }
  } catch {
    // enrichment unreachable — fall through to the heuristic-only doc below
  }
  // Minimal, flagged: name + whatever the name heuristics can infer.
  return { _type: "ingredient", name, ...fallbackMetadata(name) };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/ingredients/get-or-create.test.ts`
Expected: PASS (all four cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ingredients/get-or-create.ts src/lib/ingredients/get-or-create.test.ts
git commit -m "feat(3a): shared getOrCreateEnrichedIngredient helper (enrich-on-create + fallback)"
```

---

## Task 4: Use the helper in `recipe-actions` (close the bare-create gap)

**Files:**
- Modify: `src/app/actions/recipe-actions.ts`
- Modify: `src/app/actions/recipe-actions.test.ts`

- [ ] **Step 1: Update the test mocks first**

In `src/app/actions/recipe-actions.test.ts`, add a mock for the new helper alongside the existing mocks (after the `next/cache` mock):

```ts
vi.mock("@/lib/ingredients/get-or-create", () => ({
  getOrCreateEnrichedIngredient: vi.fn().mockResolvedValue("ing-id"),
}));
```

- [ ] **Step 2: Run the suite to confirm it still passes (baseline)**

Run: `npx vitest run src/app/actions/recipe-actions.test.ts`
Expected: PASS — the existing guard tests (title required, auth, non-recipe target) don't create ingredients, so adding the mock is inert until Step 3.

- [ ] **Step 3: Replace `resolveIngredientId` with the shared helper**

In `src/app/actions/recipe-actions.ts`:

Add the import near the top (with the other `@/` imports):

```ts
import { getOrCreateEnrichedIngredient } from "@/lib/ingredients/get-or-create";
```

Delete the `resolveIngredientId` function (lines defining it, currently ~23-35):

```ts
async function resolveIngredientId(
  write: ReturnType<typeof getWriteClient>,
  name: string,
): Promise<string> {
  const clean = name.trim();
  const existing = await reader().fetch<{ _id: string } | null>(
    `*[_type == "ingredient" && lower(name) == lower($name)][0]{ _id }`,
    { name: clean },
  );
  if (existing?._id) return existing._id;
  const created = await write.create({ _type: "ingredient", name: clean });
  return created._id;
}
```

In `saveRecipe`, change the call site (currently `const id = await resolveIngredientId(write, names[i]);`) to:

```ts
    const id = await getOrCreateEnrichedIngredient(names[i]);
```

- [ ] **Step 4: Run the suite + typecheck**

Run: `npx vitest run src/app/actions/recipe-actions.test.ts && npx tsc --noEmit`
Expected: PASS — `getWriteClient` is still imported/used elsewhere in the file (image upload, patch/create), so no unused-import error.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/recipe-actions.ts src/app/actions/recipe-actions.test.ts
git commit -m "refactor(3a): recipe form creates ingredients via the enriched-create helper"
```

---

## Task 5: `KitchenSubnav` component

**Files:**
- Create: `src/components/kitchen-subnav.tsx`
- Test: `src/components/kitchen-subnav.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/kitchen-subnav.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/shop",
}));

import { KitchenSubnav } from "@/components/kitchen-subnav";

describe("KitchenSubnav", () => {
  it("renders Menu, Shop, and Pantry links", () => {
    render(<KitchenSubnav />);
    expect(screen.getByRole("link", { name: "Menu" })).toHaveAttribute("href", "/menu");
    expect(screen.getByRole("link", { name: "Shop" })).toHaveAttribute("href", "/shop");
    expect(screen.getByRole("link", { name: "Pantry" })).toHaveAttribute("href", "/pantry");
  });

  it("marks the current route as the active page", () => {
    render(<KitchenSubnav />);
    expect(screen.getByRole("link", { name: "Shop" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Menu" })).not.toHaveAttribute("aria-current");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/kitchen-subnav.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement the component**

Create `src/components/kitchen-subnav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const KITCHEN_LINKS = [
  { href: "/menu", label: "Menu" },
  { href: "/shop", label: "Shop" },
  { href: "/pantry", label: "Pantry" },
] as const;

export function KitchenSubnav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Kitchen" className="flex gap-2">
      {KITCHEN_LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`kicker rounded-full px-4 py-2 transition-colors ${
              active
                ? "bg-terracotta text-paper"
                : "text-ink-soft hover:text-terracotta"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/kitchen-subnav.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/kitchen-subnav.tsx src/components/kitchen-subnav.test.tsx
git commit -m "feat(3a): KitchenSubnav segmented Menu/Shop/Pantry control"
```

---

## Task 6: Route stubs + repoint the header link (Plan → Kitchen / `/menu`)

**Files:**
- Create: `src/app/(site)/menu/page.tsx`, `src/app/(site)/shop/page.tsx`, `src/app/(site)/pantry/page.tsx`
- Modify: `src/components/auth-controls.tsx`
- Modify: `src/components/auth-controls.test.tsx`

- [ ] **Step 1: Update the auth-controls test (red)**

In `src/components/auth-controls.test.tsx`, change the two member-link assertions:

In the `"renders the Plan link..."` test, rename it and assert the Kitchen link:

```ts
  it("renders the Kitchen link, name, and Sign out for a household member", () => {
    mockUseQuery.mockReturnValue({ name: "Jacob", householdId: "h1" });
    render(<AuthControls />);
    const kitchen = screen.getByRole("link", { name: "Kitchen" });
    expect(kitchen).toHaveAttribute("href", "/menu");
    expect(screen.getByText("Jacob")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
```

In the `"renders Finish setup (not Plan)..."` test, swap the negative assertion:

```ts
    expect(screen.queryByRole("link", { name: "Kitchen" })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/auth-controls.test.tsx`
Expected: FAIL — the component still renders "Plan" → `/plan`.

- [ ] **Step 3: Repoint the link in `auth-controls.tsx`**

In `src/components/auth-controls.tsx`, change the member `Link` (currently `href="/plan"` with text `Plan`):

```tsx
          <Link
            href="/menu"
            className="kicker text-ink-soft transition-colors hover:text-terracotta"
          >
            Kitchen
          </Link>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/auth-controls.test.tsx`
Expected: PASS.

- [ ] **Step 5: Create the three stub pages**

Create `src/app/(site)/menu/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { KitchenSubnav } from "@/components/kitchen-subnav";

export default async function MenuPage() {
  const viewer = await getViewer();
  if (!viewer.isAuthenticated) redirect("/");
  if (!viewer.isMember) redirect("/household/setup");

  return (
    <section className="mx-auto max-w-2xl">
      <KitchenSubnav />
      <h1 className="editorial-display mt-6 text-4xl text-ink">Menu</h1>
      <p className="mt-3 text-ink-soft">Coming soon.</p>
    </section>
  );
}
```

Create `src/app/(site)/shop/page.tsx` — identical but `MenuPage`→`ShopPage`, heading `Shop`.

Create `src/app/(site)/pantry/page.tsx` — identical but `MenuPage`→`PantryPage`, heading `Pantry`.

- [ ] **Step 6: Verify the routes build (typecheck) + full gate**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: PASS — no type errors, lint clean, full suite green (~290 prior + the new tests).

- [ ] **Step 7: Validate Convex still deploys (no Convex changes, smoke check)**

Run: `npx convex dev --once`
Expected: deploys clean to `perfect-fennec-845` (3a adds no Convex functions; this confirms nothing broke).

- [ ] **Step 8: Commit**

```bash
git add "src/app/(site)/menu/page.tsx" "src/app/(site)/shop/page.tsx" "src/app/(site)/pantry/page.tsx" src/components/auth-controls.tsx src/components/auth-controls.test.tsx
git commit -m "feat(3a): Kitchen header entry + /menu /shop /pantry route stubs"
```

---

## Post-implementation gate (whole sub-plan)

- [ ] Full gate green: `npx vitest run` + `npm run lint` + `npx tsc --noEmit` + `npx convex dev --once`.
- [ ] `/code-review` against the 3a commits; address findings (just-apply small fixes; surface flow/architecture/scope changes).
- [ ] Confirm: the header "Kitchen" link reaches `/menu`; `KitchenSubnav` switches active state across the three stubs; adding a recipe ingredient via the form still works (now via the enriched helper). Note `SANITY_API_WRITE_TOKEN` + `ANTHROPIC_API_KEY` must be set for live enriched-create (already configured per Spec 2 status).

---

## Self-review notes (coverage check against the spec)

- Spec §6.1 (batch catalog query folded into read API) → Tasks 1–2.
- Spec §6.2 (`getOrCreateEnrichedIngredient` + recipe-form unify + fallback) → Tasks 3–4.
- Spec §3 (Kitchen umbrella + sub-nav + route scaffolding + Plan→Menu rename) → Tasks 5–6.
- Out of 3a scope (correctly deferred): real Menu/Shop/Pantry view bodies (3b–3d), `getCookableCoverage` wiring + filter rework (3e), retiring `plan-view.tsx`/`plan-actions.ts`/`/plan` (3d), `filterCookable` removal + `revalidatePath` fix + migrate-tool removal (3e).
- The `nonfood` flag mentioned loosely in the spec is represented as `category === "nonfood"` (the actual Sanity schema encodes it in `category`); the batch query returns `category`, so no separate field is needed.
