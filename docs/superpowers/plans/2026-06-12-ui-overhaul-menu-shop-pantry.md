# UI Overhaul: Menu, Shop, Pantry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved spec `docs/superpowers/specs/2026-06-12-ui-overhaul-menu-shop-pantry-design.md` — whole-number pantry quantities, a real buy-quantity model, one shop check-off mode, a category-grouped pantry ledger with cart/X actions, editorial menu cards, and small home/recipe hierarchy tweaks.

**Architecture:** Next.js 16 App Router + Convex (household-scoped kitchen state) + Sanity (recipe/ingredient catalog). Pure kitchen math lives in `src/lib/kitchen/*` (unit-tested with vitest/jsdom); Convex functions are tested with `convex-test` (edge-runtime); server actions in `src/app/actions/*` orchestrate Convex + Sanity; client components are thin optimistic views.

**Tech Stack:** TypeScript, Tailwind v4 utility classes (no component library), `motion/react`, vitest + @testing-library/react, convex-test.

**Branch:** create `feat/ui-overhaul` from `design/ui-overhaul-spec` before Task 1:
```bash
git checkout -b feat/ui-overhaul
```

**Conventions you must follow** (observed in this repo):
- Convex tests: `convex/*.test.ts`, header `// @vitest-environment edge-runtime` + `/// <reference types="vite/client" />`, `const modules = import.meta.glob("./**/*.*s");`, the `member()` helper (see `convex/pantry.test.ts:10-15`).
- Component tests: `vi.hoisted` mocks of `@/app/actions/kitchen-actions` and `@/components/toast` (see `src/components/shop-view.test.tsx:5-12`).
- Optimistic UI: snapshot state → apply → `act(action, revert, onSuccess?)` inside `useTransition` (see `src/components/pantry-view.tsx:16-31`).
- Buttons/links use the `kicker` class; quiet actions are `text-ink-soft hover:text-terracotta`; primary pills are `rounded-full bg-terracotta px-4 py-1.5 text-paper hover:bg-terracotta-deep`.
- Run a single test file: `npx vitest run src/lib/kitchen/format-amount.test.ts`

---

## File Structure (what's created/modified)

```
convex/
  schema.ts                        modify: groceryItems source union + buyQuantityG
  pantry.ts                        modify: rounding, depleteItem; delete setRestockOverride
  cook.ts                          modify: rounding in depleteOne
  grocery.ts                       modify: buyQuantityG, setBuyQuantity, removeBought, clearStale
  migrations.ts                    modify: add roundPantryQuantities
  pantry.test.ts / grocery.test.ts / cook.test.ts   modify
src/lib/kitchen/
  format-amount.ts                 modify: integer display
  buy-quantity.ts                  create: resolveBuyQuantity (pure)
  cookable.ts                      modify: Coverage gains missing[]
  shop-grouping.ts                 modify: buyQuantityG on items, shopItemMetaLabel
  pantry-grouping.ts               create: groupPantryRows (pure)
  (+ matching .test.ts files)
src/sanity/lib/kitchen-queries.ts  modify: catalog density/avgUnitGrams; menu cover/time/servings
src/app/actions/
  kitchen-data.ts                  modify: buy defaults in getShopData; onList in getPantryData
  kitchen-actions.ts               modify: markBought(buyQuantityG), setBuyQuantity,
                                   depletePantryItem, reconcileStale; delete setRestockOverride
src/components/
  toast.tsx                        modify: multi-action support
  shop-view.tsx / shop-item-row.tsx        rewrite (single mode, quiet rows)
  pantry-view.tsx / pantry-row.tsx         rewrite (grouped ledger, cart/X)
  menu-view.tsx / menu-recipe-row.tsx      rewrite (editorial cards)
  recipe-card.tsx                  modify: to-try mark always
  filter-controls.tsx              modify: merge collection + cookable rows
  recipe-actions-menu.tsx          create: ⋯ overflow (Edit/Share/Delete)
src/app/(site)/
  menu/page.tsx                    modify: kicker count
  pantry/page.tsx                  modify: new row props
  recipe/[slug]/page.tsx           modify: action hierarchy
```

---

### Task 1: Whole-number display formatting

**Files:**
- Modify: `src/lib/kitchen/format-amount.ts`
- Test: `src/lib/kitchen/format-amount.test.ts`

- [ ] **Step 1: Update the tests to expect integers**

Open `src/lib/kitchen/format-amount.test.ts`. Replace every expectation that involves one-decimal rounding with integer rounding. The resulting file must contain these cases (keep the existing imports/describe structure; replace the bodies of the rounding/format tests):

```ts
import { describe, it, expect } from "vitest";
import {
  roundForDisplay,
  formatCanonicalAmount,
  canonicalUnitLabel,
  pantryNudgeStep,
} from "@/lib/kitchen/format-amount";

describe("roundForDisplay", () => {
  it("rounds to whole numbers (half up)", () => {
    expect(roundForDisplay(2.5)).toBe(3);
    expect(roundForDisplay(2.4)).toBe(2);
    expect(roundForDisplay(740.3)).toBe(740);
    expect(roundForDisplay(0.4)).toBe(0);
  });
});

describe("formatCanonicalAmount", () => {
  it("formats mass/volume as whole grams", () => {
    expect(formatCanonicalAmount(473.2, "mass")).toBe("473 g");
    expect(formatCanonicalAmount(239.6, "volume")).toBe("240 g");
  });
  it("formats count as a bare whole number", () => {
    expect(formatCanonicalAmount(2.5, "count")).toBe("3");
    expect(formatCanonicalAmount(3, null)).toBe("3");
  });
});

describe("canonicalUnitLabel", () => {
  it("labels kinds", () => {
    expect(canonicalUnitLabel("mass")).toBe("g");
    expect(canonicalUnitLabel("volume")).toBe("g");
    expect(canonicalUnitLabel("count")).toBe("count");
    expect(canonicalUnitLabel(null)).toBe("units");
  });
});

describe("pantryNudgeStep", () => {
  it("nudges 10 g for mass/volume, 1 for count", () => {
    expect(pantryNudgeStep("mass")).toBe(10);
    expect(pantryNudgeStep("count")).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/kitchen/format-amount.test.ts`
Expected: FAIL — `roundForDisplay(2.5)` returns `2.5`.

- [ ] **Step 3: Implement**

In `src/lib/kitchen/format-amount.ts`, replace `roundForDisplay`:

```ts
/** Round to a whole number (half up) — pantry amounts are always integers. */
export function roundForDisplay(n: number): number {
  return Math.round(n);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/kitchen/format-amount.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/kitchen/format-amount.ts src/lib/kitchen/format-amount.test.ts
git commit -m "feat: whole-number display for pantry amounts"
```

---

### Task 2: Convex pantry — round writes, add depleteItem, drop setRestockOverride

**Files:**
- Modify: `convex/pantry.ts`
- Test: `convex/pantry.test.ts`

- [ ] **Step 1: Update/extend the tests**

In `convex/pantry.test.ts`: DELETE the test `"setRestockOverride stores and clears the override"` (lines 37-50) and ADD:

```ts
test("pantry writes round to whole numbers", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.pantry.adjustPantry, { ingredientId: "i1", deltaG: 250.4 });
  expect((await a.query(api.pantry.pantry, {}))[0].quantityG).toBe(250);
  await a.mutation(api.pantry.setPantryQuantity, { ingredientId: "i1", quantityG: 99.6 });
  expect((await a.query(api.pantry.pantry, {}))[0].quantityG).toBe(100);
});

test("depleteItem removes the row and is idempotent", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.pantry.adjustPantry, { ingredientId: "i1", deltaG: 100 });
  await a.mutation(api.pantry.depleteItem, { ingredientId: "i1" });
  expect(await a.query(api.pantry.pantry, {})).toHaveLength(0);
  // second call is a no-op, not an error
  await a.mutation(api.pantry.depleteItem, { ingredientId: "i1" });
  expect(await a.query(api.pantry.pantry, {})).toHaveLength(0);
});

test("depleteItem requires membership", async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.mutation(api.pantry.depleteItem, { ingredientId: "i1" }),
  ).rejects.toThrow();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run convex/pantry.test.ts`
Expected: FAIL — `api.pantry.depleteItem` doesn't exist; rounding test fails (250.4 stored as-is). The deleted setRestockOverride test is gone.

- [ ] **Step 3: Implement**

In `convex/pantry.ts`:

1. `adjustPantry` handler — round the result:
```ts
const next = Math.max(0, Math.round((existing?.quantityG ?? 0) + deltaG));
```
2. `setPantryQuantity` handler — round before writing. Replace both write sites' `quantityG` with a rounded local:
```ts
const rounded = Math.round(quantityG);
```
…and use `quantityG: rounded` in the `patch` and `insert` calls.
3. DELETE the entire `setRestockOverride` mutation (lines 86-112).
4. ADD:
```ts
/** "Out of it" — remove the household's pantry row entirely. Idempotent. */
export const depleteItem = mutation({
  args: { ingredientId: v.string() },
  handler: async (ctx, { ingredientId }) => {
    const { householdId } = await requireMembership(ctx);
    const existing = await pantryRow(ctx, householdId, ingredientId);
    if (existing) await ctx.db.delete(existing._id);
  },
});
```
5. In the `pantry` query, stop returning the deprecated override — replace the `rows.map` return with:
```ts
return rows.map((r) => ({
  ingredientId: r.ingredientId,
  quantityG: r.quantityG,
  updatedAt: r.updatedAt,
}));
```
(The `restockOverride` field stays in the schema as deprecated data; it is no longer read or written.)

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run convex/pantry.test.ts`
Expected: PASS. (Other suites will break until Tasks 8–9 update the callers — that's expected; don't run the full suite yet.)

- [ ] **Step 5: Commit**

```bash
git add convex/pantry.ts convex/pantry.test.ts
git commit -m "feat: integer pantry writes, depleteItem; retire setRestockOverride"
```

---

### Task 3: Convex cook — round depletion results

**Files:**
- Modify: `convex/cook.ts:18`
- Test: `convex/cook.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `convex/cook.test.ts` (reuse that file's existing `member` helper and imports):

```ts
test("cook depletion rounds the remaining quantity to a whole number", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.pantry.adjustPantry, { ingredientId: "i1", deltaG: 500 });
  await a.mutation(api.cook.cook, {
    recipeId: "r1",
    at: Date.now(),
    deltas: [{ ingredientId: "i1", subtract: 120.4 }],
  });
  expect((await a.query(api.pantry.pantry, {}))[0].quantityG).toBe(380);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run convex/cook.test.ts`
Expected: FAIL — quantity is `379.6`.

- [ ] **Step 3: Implement**

In `convex/cook.ts` `depleteOne` (line 18), replace:
```ts
const next = Math.max(0, (existing?.quantityG ?? 0) - subtract);
```
with:
```ts
const next = Math.max(0, Math.round((existing?.quantityG ?? 0) - subtract));
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run convex/cook.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/cook.ts convex/cook.test.ts
git commit -m "feat: round pantry quantity after cook depletion"
```

---

### Task 4: Migration — round existing pantry quantities

**Files:**
- Modify: `convex/migrations.ts`
- Test: `convex/migrations.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `convex/migrations.test.ts`:

```ts
// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

test("roundPantryQuantities rounds existing decimal rows and reports counts", async () => {
  const t = convexTest(schema, modules);
  const householdId = await t.run(async (ctx) => {
    const ownerUserId = await ctx.db.insert("users", { email: "a@example.com" });
    const hh = await ctx.db.insert("households", { name: "h", ownerUserId });
    await ctx.db.insert("pantryItems", {
      householdId: hh, ingredientId: "i1", quantityG: 740.3, updatedAt: 1,
    });
    await ctx.db.insert("pantryItems", {
      householdId: hh, ingredientId: "i2", quantityG: 100, updatedAt: 1,
    });
    return hh;
  });
  const result = await t.mutation(internal.migrations.roundPantryQuantities, {});
  expect(result).toEqual({ scanned: 2, updated: 1 });
  const rows = await t.run(async (ctx) =>
    ctx.db
      .query("pantryItems")
      .withIndex("by_household", (q) => q.eq("householdId", householdId))
      .collect(),
  );
  expect(rows.map((r) => r.quantityG).sort()).toEqual([100, 740]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run convex/migrations.test.ts`
Expected: FAIL — `roundPantryQuantities` is not defined.

- [ ] **Step 3: Implement**

Append to `convex/migrations.ts`:

```ts
/**
 * One-time (idempotent): round all pantry quantities to whole numbers.
 * Run on each deployment that has data, BEFORE shipping the integer-write UI:
 *
 *   npx convex run migrations:roundPantryQuantities
 *
 * Table is small (one row per household ingredient), so a single collect()
 * stays well inside transaction limits.
 */
export const roundPantryQuantities = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("pantryItems").collect();
    let updated = 0;
    for (const row of rows) {
      const rounded = Math.round(row.quantityG);
      if (rounded !== row.quantityG) {
        await ctx.db.patch(row._id, { quantityG: rounded });
        updated++;
      }
    }
    return { scanned: rows.length, updated };
  },
});
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run convex/migrations.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the migration against the dev deployment**

```bash
npx convex run migrations:roundPantryQuantities
```
Expected output: `{ scanned: <n>, updated: <m> }`. (Note for the final report: this must also be run against prod at deploy time — it's idempotent.)

- [ ] **Step 6: Commit**

```bash
git add convex/migrations.ts convex/migrations.test.ts
git commit -m "feat: migration to round existing pantry quantities"
```

---

### Task 5: Schema + grocery — buy-quantity overrides

**Files:**
- Modify: `convex/schema.ts:84-97`, `convex/grocery.ts`
- Test: `convex/grocery.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `convex/grocery.test.ts` (reuse its existing `member` helper). Two adjustments to existing tests while you're there: (a) any test calling `api.grocery.clearSkips` now calls `api.grocery.clearStale`; (b) any exact-shape assertion on the `grocery` query result (`toEqual` on row objects) gains `buyQuantityG: null`.

```ts
test("setBuyQuantity creates an override row for a need item", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.grocery.setBuyQuantity, { ingredientId: "i1", buyQuantityG: 500 });
  const rows = await a.query(api.grocery.grocery, {});
  expect(rows).toEqual([
    { ingredientId: "i1", source: "override", manualQuantity: null, buyQuantityG: 500 },
  ]);
});

test("setBuyQuantity on a manual row keeps it manual", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.grocery.addManualItem, { ingredientId: "i1" });
  await a.mutation(api.grocery.setBuyQuantity, { ingredientId: "i1", buyQuantityG: 3 });
  const rows = await a.query(api.grocery.grocery, {});
  expect(rows[0].source).toBe("manual");
  expect(rows[0].buyQuantityG).toBe(3);
});

test("setBuyQuantity rejects non-positive and fractional values", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await expect(
    a.mutation(api.grocery.setBuyQuantity, { ingredientId: "i1", buyQuantityG: 0 }),
  ).rejects.toThrow();
  await expect(
    a.mutation(api.grocery.setBuyQuantity, { ingredientId: "i1", buyQuantityG: 2.5 }),
  ).rejects.toThrow();
});

test("skip clears a stored buy quantity", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.grocery.setBuyQuantity, { ingredientId: "i1", buyQuantityG: 500 });
  await a.mutation(api.grocery.skip, { ingredientId: "i1" });
  const rows = await a.query(api.grocery.grocery, {});
  expect(rows[0]).toEqual({
    ingredientId: "i1", source: "skip", manualQuantity: null, buyQuantityG: null,
  });
});

test("removeBought deletes manual and override rows but not skips", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.grocery.addManualItem, { ingredientId: "m1" });
  await a.mutation(api.grocery.setBuyQuantity, { ingredientId: "o1", buyQuantityG: 2 });
  await a.mutation(api.grocery.skip, { ingredientId: "s1" });
  await a.mutation(api.grocery.removeBought, { ingredientId: "m1" });
  await a.mutation(api.grocery.removeBought, { ingredientId: "o1" });
  await a.mutation(api.grocery.removeBought, { ingredientId: "s1" });
  const rows = await a.query(api.grocery.grocery, {});
  expect(rows).toHaveLength(1);
  expect(rows[0].source).toBe("skip");
});

test("clearStale removes skip and override rows for the given ids", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.grocery.skip, { ingredientId: "s1" });
  await a.mutation(api.grocery.setBuyQuantity, { ingredientId: "o1", buyQuantityG: 2 });
  await a.mutation(api.grocery.addManualItem, { ingredientId: "m1" });
  await a.mutation(api.grocery.clearStale, { ingredientIds: ["s1", "o1", "m1"] });
  const rows = await a.query(api.grocery.grocery, {});
  expect(rows).toHaveLength(1);
  expect(rows[0].source).toBe("manual");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run convex/grocery.test.ts`
Expected: FAIL — schema rejects `"override"`, new mutations missing.

- [ ] **Step 3: Implement schema**

In `convex/schema.ts`, replace the `groceryItems` table definition with:

```ts
  // Per-household grocery rows: manual additions (+), skip suppressions (-),
  // and buy-quantity overrides for plan-derived needs. Plan-derived needs are
  // computed (not stored). buyQuantityG is the canonical whole-number amount
  // the shopper intends to buy (added to the pantry on check-off).
  groceryItems: defineTable({
    householdId: v.id("households"),
    ingredientId: v.string(),
    source: v.union(v.literal("manual"), v.literal("skip"), v.literal("override")),
    manualQuantity: v.optional(
      v.object({ quantity: v.number(), unit: v.string() }),
    ),
    buyQuantityG: v.optional(v.number()),
    addedByUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_household", ["householdId"])
    .index("by_household_ingredient", ["householdId", "ingredientId"]),
```

Also add a deprecation note on `pantryItems.restockOverride` (comment only):
```ts
    // DEPRECATED (2026-06): no longer read or written; buy quantities live on
    // groceryItems.buyQuantityG. Kept so historical rows still validate.
    restockOverride: v.optional(
      v.object({ quantity: v.number(), unit: v.string() }),
    ),
```

- [ ] **Step 4: Implement grocery mutations**

In `convex/grocery.ts`:

1. `grocery` query — include the new field:
```ts
    return rows.map((r) => ({
      ingredientId: r.ingredientId,
      source: r.source,
      manualQuantity: r.manualQuantity ?? null,
      buyQuantityG: r.buyQuantityG ?? null,
    }));
```
2. `writeRow` — clear any buy quantity when a row turns into a skip (and keep it otherwise untouched). Replace the patch branch:
```ts
  if (existing) {
    await ctx.db.patch(existing._id, {
      source,
      manualQuantity,
      ...(source === "skip" ? { buyQuantityG: undefined } : {}),
    });
    return;
  }
```
3. ADD after `addManualItem`:
```ts
export const setBuyQuantity = mutation({
  args: { ingredientId: v.string(), buyQuantityG: v.number() },
  handler: async (ctx, { ingredientId, buyQuantityG }) => {
    if (!Number.isInteger(buyQuantityG) || buyQuantityG <= 0) {
      throw new Error("Buy quantity must be a positive whole number");
    }
    const { householdId, userId } = await requireMembership(ctx);
    const existing = await groceryRow(ctx, householdId, ingredientId);
    if (existing) {
      await ctx.db.patch(existing._id, {
        // a manual row stays manual; skip/override rows become overrides
        source: existing.source === "manual" ? "manual" : "override",
        buyQuantityG,
      });
      return;
    }
    await ctx.db.insert("groceryItems", {
      householdId,
      ingredientId,
      source: "override",
      buyQuantityG,
      addedByUserId: userId,
      createdAt: Date.now(),
    });
  },
});

/** Delete the bought item's manual/override row (skips are not "bought"). */
export const removeBought = mutation({
  args: { ingredientId: v.string() },
  handler: async (ctx, { ingredientId }) => {
    const { householdId } = await requireMembership(ctx);
    const existing = await groceryRow(ctx, householdId, ingredientId);
    if (existing && existing.source !== "skip") await ctx.db.delete(existing._id);
  },
});
```
4. REPLACE `clearSkips` with `clearStale` (same shape, also clears overrides):
```ts
export const clearStale = mutation({
  args: { ingredientIds: v.array(v.string()) },
  handler: async (ctx, { ingredientIds }) => {
    const { householdId } = await requireMembership(ctx);
    for (const ingredientId of ingredientIds) {
      const existing = await groceryRow(ctx, householdId, ingredientId);
      if (existing && (existing.source === "skip" || existing.source === "override")) {
        await ctx.db.delete(existing._id);
      }
    }
  },
});
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run convex/grocery.test.ts convex/schema.test.ts`
Expected: PASS (fix any schema test that asserts the old source union).

- [ ] **Step 6: Commit**

```bash
git add convex/schema.ts convex/grocery.ts convex/grocery.test.ts convex/schema.test.ts
git commit -m "feat: grocery buy-quantity overrides (setBuyQuantity/removeBought/clearStale)"
```

---

### Task 6: Pure lib — resolveBuyQuantity

**Files:**
- Create: `src/lib/kitchen/buy-quantity.ts`
- Test: `src/lib/kitchen/buy-quantity.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/kitchen/buy-quantity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveBuyQuantity } from "@/lib/kitchen/buy-quantity";

const base = { override: null, restockCanonical: null, needAmount: null, manualCanonical: null };

describe("resolveBuyQuantity", () => {
  it("prefers the stored override", () => {
    expect(resolveBuyQuantity({ ...base, override: 500, restockCanonical: 473, needAmount: 240 })).toBe(500);
  });
  it("falls back to the restock default", () => {
    expect(resolveBuyQuantity({ ...base, restockCanonical: 473, needAmount: 240 })).toBe(473);
  });
  it("falls back to the needed amount, rounded up", () => {
    expect(resolveBuyQuantity({ ...base, needAmount: 239.2 })).toBe(240);
  });
  it("falls back to the manual quantity, rounded up", () => {
    expect(resolveBuyQuantity({ ...base, manualCanonical: 2.5 })).toBe(3);
  });
  it("returns null when nothing is resolvable", () => {
    expect(resolveBuyQuantity(base)).toBe(null);
  });
  it("ignores zero/negative/NaN candidates and never returns less than 1", () => {
    expect(resolveBuyQuantity({ ...base, restockCanonical: 0, needAmount: 0.2 })).toBe(1);
    expect(resolveBuyQuantity({ ...base, restockCanonical: NaN, needAmount: -3 })).toBe(null);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/kitchen/buy-quantity.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/kitchen/buy-quantity.ts`:

```ts
export type BuyQuantityInputs = {
  /** Stored groceryItems.buyQuantityG (already a positive integer). */
  override: number | null;
  /** Catalog restock default converted to canonical units. */
  restockCanonical: number | null;
  /** Computed plan need in canonical units (need items only). */
  needAmount: number | null;
  /** Manual row's quantity converted to canonical units (manual items only). */
  manualCanonical: number | null;
};

/**
 * The whole-number canonical amount a shopper will buy — and exactly what gets
 * added to the pantry on check-off. Resolution order: explicit override →
 * restock default → needed amount → manual quantity. Null when nothing is
 * resolvable (the row then checks off without a pantry write).
 */
export function resolveBuyQuantity(i: BuyQuantityInputs): number | null {
  for (const candidate of [i.override, i.restockCanonical, i.needAmount, i.manualCanonical]) {
    if (candidate != null && Number.isFinite(candidate) && candidate > 0) {
      return Math.max(1, Math.ceil(candidate));
    }
  }
  return null;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/kitchen/buy-quantity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/kitchen/buy-quantity.ts src/lib/kitchen/buy-quantity.test.ts
git commit -m "feat: resolveBuyQuantity fallback chain"
```

---

### Task 7: Coverage gains the missing-ingredient list

**Files:**
- Modify: `src/lib/kitchen/cookable.ts`
- Test: `src/lib/kitchen/cookable.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/lib/kitchen/cookable.test.ts` (match its existing requirement-literal style — `IngredientRequirement` objects with `ingredientId, name, amount, optional, category`):

```ts
it("lists the missing required ingredients by id and name", () => {
  const reqs = [
    { ingredientId: "a", name: "apples", amount: 3, optional: false, category: "produce" as const },
    { ingredientId: "b", name: "butter", amount: 50, optional: false, category: "dairy" as const },
    { ingredientId: "c", name: "chives", amount: 5, optional: true, category: "produce" as const },
  ];
  const cov = recipeCoverage(reqs, new Map([["a", 3]]));
  expect(cov.cookable).toBe(false);
  expect(cov.missingRequired).toBe(1);
  expect(cov.missing).toEqual([{ ingredientId: "b", name: "butter" }]);
});

it("returns an empty missing list when cookable", () => {
  const reqs = [
    { ingredientId: "a", name: "apples", amount: 3, optional: false, category: "produce" as const },
  ];
  expect(recipeCoverage(reqs, new Map([["a", 5]])).missing).toEqual([]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/kitchen/cookable.test.ts`
Expected: FAIL — `missing` is undefined.

- [ ] **Step 3: Implement**

Replace `src/lib/kitchen/cookable.ts` with:

```ts
import type { IngredientRequirement } from "@/lib/kitchen/types";

export type Coverage = {
  cookable: boolean;
  missingRequired: number;
  missing: { ingredientId: string; name: string }[];
};

/**
 * Coverage of ONE recipe against the pantry. Only required, non-nonfood
 * ingredients count; duplicate lines for the same ingredient are summed.
 * `cookable` is true only when there is at least one qualifying required
 * ingredient and the pantry covers all of them. `missing` lists the shortfall
 * ingredients (id + name) for display.
 */
export function recipeCoverage(
  requirements: IngredientRequirement[],
  pantry: Map<string, number>,
): Coverage {
  const required = new Map<string, { amount: number; name: string }>();
  for (const r of requirements) {
    if (r.optional || r.category === "nonfood") continue;
    const cur = required.get(r.ingredientId);
    if (cur) cur.amount += r.amount;
    else required.set(r.ingredientId, { amount: r.amount, name: r.name });
  }

  if (required.size === 0) return { cookable: false, missingRequired: 0, missing: [] };

  const missing: { ingredientId: string; name: string }[] = [];
  for (const [ingredientId, { amount, name }] of required) {
    if ((pantry.get(ingredientId) ?? 0) < amount) missing.push({ ingredientId, name });
  }
  return { cookable: missing.length === 0, missingRequired: missing.length, missing };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/kitchen/cookable.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/kitchen/cookable.ts src/lib/kitchen/cookable.test.ts
git commit -m "feat: coverage exposes missing ingredient list"
```

---

### Task 8: Shop grouping — buy quantities on items + meta label

**Files:**
- Modify: `src/lib/kitchen/shop-grouping.ts`
- Test: `src/lib/kitchen/shop-grouping.test.ts`

- [ ] **Step 1: Update tests**

In `src/lib/kitchen/shop-grouping.test.ts`: every `ShopNeed`/`ShopManual` literal gains `buyQuantityG` (use real values, e.g. `buyQuantityG: 500` on a need, `buyQuantityG: null` on an unresolvable manual). Replace any `shopItemAmountLabel` tests with:

```ts
import { shopItemMetaLabel } from "@/lib/kitchen/shop-grouping";

describe("shopItemMetaLabel", () => {
  it("shows buying and needs for a need item", () => {
    const item = {
      ingredientId: "i", name: "cream", category: "dairy", optional: false,
      source: "need" as const, amount: 240, canonicalUnitKind: "mass" as const,
      manualQuantity: null, buyQuantityG: 473,
    };
    expect(shopItemMetaLabel(item)).toBe("buying 473 g · needs 240 g");
  });
  it("shows only buying for a manual item with a resolved quantity", () => {
    const item = {
      ingredientId: "i", name: "eggs", category: "dairy", optional: false,
      source: "manual" as const, amount: null, canonicalUnitKind: "count" as const,
      manualQuantity: { quantity: 12, unit: "" }, buyQuantityG: 12,
    };
    expect(shopItemMetaLabel(item)).toBe("buying 12");
  });
  it("falls back to the raw manual quantity text when unresolved", () => {
    const item = {
      ingredientId: "i", name: "napkins", category: "nonfood", optional: false,
      source: "manual" as const, amount: null, canonicalUnitKind: null,
      manualQuantity: { quantity: 1, unit: "pack" }, buyQuantityG: null,
    };
    expect(shopItemMetaLabel(item)).toBe("1 pack");
  });
  it("is empty when nothing is known", () => {
    const item = {
      ingredientId: "i", name: "x", category: null, optional: false,
      source: "manual" as const, amount: null, canonicalUnitKind: null,
      manualQuantity: null, buyQuantityG: null,
    };
    expect(shopItemMetaLabel(item)).toBe("");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/kitchen/shop-grouping.test.ts`
Expected: FAIL — type errors / missing export.

- [ ] **Step 3: Implement**

In `src/lib/kitchen/shop-grouping.ts`:

1. Add `buyQuantityG: number | null;` to `ShopNeed`, `ShopManual`, and `ShopItem`.
2. In `buildShopItems`, carry it through both branches: `buyQuantityG: n.buyQuantityG,` and `buyQuantityG: m.buyQuantityG,`.
3. REPLACE `shopItemAmountLabel` with:

```ts
/**
 * One muted meta line per row: "buying 473 g · needs 240 g". Falls back to the
 * raw manual quantity text when no canonical buy amount could be resolved.
 */
export function shopItemMetaLabel(item: ShopItem): string {
  const parts: string[] = [];
  if (item.buyQuantityG != null) {
    parts.push(`buying ${formatCanonicalAmount(item.buyQuantityG, item.canonicalUnitKind)}`);
  }
  if (item.source === "need" && item.amount != null) {
    parts.push(`needs ${formatCanonicalAmount(item.amount, item.canonicalUnitKind)}`);
  }
  if (parts.length === 0 && item.manualQuantity) {
    return `${item.manualQuantity.quantity} ${item.manualQuantity.unit}`.trim();
  }
  return parts.join(" · ");
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/kitchen/shop-grouping.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/kitchen/shop-grouping.ts src/lib/kitchen/shop-grouping.test.ts
git commit -m "feat: shop items carry buy quantity; combined meta label"
```

---

### Task 9: Pantry grouping lib

**Files:**
- Create: `src/lib/kitchen/pantry-grouping.ts`
- Test: `src/lib/kitchen/pantry-grouping.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/kitchen/pantry-grouping.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { groupPantryRows } from "@/lib/kitchen/pantry-grouping";

const row = (name: string, category: string | null) => ({ name, category });

describe("groupPantryRows", () => {
  it("groups by store category in aisle order, alphabetical within", () => {
    const groups = groupPantryRows([
      row("olive oil", "pantry"),
      row("yellow onion", "produce"),
      row("garlic", "produce"),
      row("milk", "dairy"),
    ]);
    expect(groups.map((g) => g.label)).toEqual(["Produce", "Dairy", "Pantry"]);
    expect(groups[0].rows.map((r) => r.name)).toEqual(["garlic", "yellow onion"]);
  });
  it("folds unknown and nonfood categories into Other", () => {
    const groups = groupPantryRows([
      row("napkins", "nonfood"),
      row("mystery", null),
      row("weird", "not-a-category"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Other");
    expect(groups[0].rows.map((r) => r.name)).toEqual(["mystery", "napkins", "weird"]);
  });
  it("omits empty groups", () => {
    expect(groupPantryRows([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/kitchen/pantry-grouping.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/kitchen/pantry-grouping.ts`:

```ts
import { STORE_CATEGORY_ORDER, CATEGORY_LABELS } from "@/lib/kitchen/shop-grouping";

export type PantryGroup<T> = { key: string; label: string; rows: T[] };

/** Pantry aisle order — same as Shop, but nonfood folds into Other. */
const PANTRY_ORDER = STORE_CATEGORY_ORDER.filter((k) => k !== "nonfood");

const categoryKey = (category: string | null): string =>
  category && (PANTRY_ORDER as readonly string[]).includes(category) ? category : "other";

/**
 * Group pantry rows by store category in aisle order (Produce → Dairy →
 * Protein → Pantry → Spice & seasoning → Other), alphabetical within each
 * group. Unknown and nonfood categories fold into Other; empty groups omitted.
 */
export function groupPantryRows<T extends { name: string; category: string | null }>(
  rows: T[],
): PantryGroup<T>[] {
  const byKey = new Map<string, T[]>();
  for (const r of rows) {
    const key = categoryKey(r.category);
    const list = byKey.get(key) ?? [];
    list.push(r);
    byKey.set(key, list);
  }
  const groups: PantryGroup<T>[] = [];
  for (const key of PANTRY_ORDER) {
    const list = byKey.get(key);
    if (list && list.length) {
      groups.push({
        key,
        label: CATEGORY_LABELS[key],
        rows: [...list].sort((a, b) => a.name.localeCompare(b.name)),
      });
    }
  }
  return groups;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/kitchen/pantry-grouping.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/kitchen/pantry-grouping.ts src/lib/kitchen/pantry-grouping.test.ts
git commit -m "feat: pantry category grouping"
```

---

### Task 10: Sanity queries + server data layer

**Files:**
- Modify: `src/sanity/lib/kitchen-queries.ts`
- Modify: `src/app/actions/kitchen-data.ts`
- Test: `src/app/actions/kitchen-data.test.ts` (update to match — follow that file's existing mock style for `fetchQuery`/Sanity client)

- [ ] **Step 1: Update `kitchen-queries.ts`**

1. `INGREDIENTS_BY_IDS_QUERY` — add conversion fields:
```ts
export const INGREDIENTS_BY_IDS_QUERY = defineQuery(`
  *[_type == "ingredient" && _id in $ids]{
    _id,
    name,
    canonicalUnitKind,
    category,
    restockQuantity,
    density,
    avgUnitGrams
  }
`);

export type CatalogInfoDoc = {
  _id: string;
  name: string;
  canonicalUnitKind: "mass" | "volume" | "count" | null;
  category: string | null;
  restockQuantity: { quantity: number; unit: string } | null;
  density: number | null;
  avgUnitGrams: number | null;
};
```
2. `MENU_RECIPES_QUERY` — add cover/time/servings:
```ts
/** Title + slug + cover + meta + optional-ingredient list for the Menu view. */
export const MENU_RECIPES_QUERY = defineQuery(`
  *[_type == "recipe" && _id in $ids]{
    _id,
    title,
    "slug": slug.current,
    "coverImage": images[0],
    prepTime,
    cookTime,
    servings,
    "optionalIngredients": ingredients[optional == true]{
      "id": ingredient._ref,
      "name": ingredient->name
    }
  }
`);

export type MenuRecipeDoc = {
  _id: string;
  title: string | null;
  slug: string | null;
  coverImage: SanityImageSource | null;
  prepTime: number | null;
  cookTime: number | null;
  servings: number | null;
  optionalIngredients: { id: string; name: string | null }[] | null;
};
```
…and add at the top of `kitchen-queries.ts`:
```ts
import type { SanityImageSource } from "@sanity/image-url";
```
3. DELETE `INGREDIENT_RESTOCK_QUERY` and `IngredientRestockDoc` (their only consumer, `markBought`, stops fetching restock data in Task 11).

- [ ] **Step 2: Update `kitchen-data.ts`**

1. The `PantryRow` type (lines 39-44) loses `restockOverride`:
```ts
type PantryRow = { ingredientId: string; quantityG: number; updatedAt: number };
```
2. Add a catalog→info adapter near the top (after imports):
```ts
import { toIngredientInfo, type RawLine } from "@/lib/kitchen/assemble";
import { restockToCanonical } from "@/lib/kitchen/assemble";
import { resolveBuyQuantity } from "@/lib/kitchen/buy-quantity";

/** CatalogInfoDoc → IngredientInfo (null when un-enriched). */
function catalogInfo(c: CatalogInfoDoc | undefined) {
  if (!c) return null;
  return toIngredientInfo({
    ingredientId: c._id,
    name: c.name,
    canonicalUnitKind: c.canonicalUnitKind,
    category: c.category,
    density: c.density,
    avgUnitGrams: c.avgUnitGrams,
  } as RawLine);
}

/** Catalog restock default in canonical units, or null. */
function restockCanonicalFor(c: CatalogInfoDoc | undefined): number | null {
  const info = catalogInfo(c);
  if (!c || !info) return null;
  return restockToCanonical(c.restockQuantity, info, c.name);
}
```
3. `getPantryData` — return category + onList instead of restock fields:
```ts
export async function getPantryData() {
  await requireMember();
  const token = await convexAuthNextjsToken();
  const opts = token ? { token } : {};
  const [rows, groceryRows] = await Promise.all([
    fetchQuery(api.pantry.pantry, {}, opts) as Promise<PantryRow[]>,
    fetchQuery(api.grocery.grocery, {}, opts) as Promise<{ ingredientId: string; source: string }[]>,
  ]);
  const onList = new Set(
    groceryRows.filter((g) => g.source === "manual").map((g) => g.ingredientId),
  );
  const info = await catalogInfoByIds(rows.map((r) => r.ingredientId));
  return rows.map((r) => {
    const c = info.get(r.ingredientId);
    return {
      ingredientId: r.ingredientId,
      quantityG: r.quantityG,
      updatedAt: r.updatedAt,
      name: c?.name ?? r.ingredientId,
      canonicalUnitKind: c?.canonicalUnitKind ?? null,
      category: c?.category ?? null,
      onList: onList.has(r.ingredientId),
    };
  });
}
```
4. `getShopData` — grocery rows now carry `buyQuantityG`; resolve a buy quantity per item. Replace the typing of `groceryRows` and the `needs`/`manual` mapping:
```ts
    fetchQuery(api.grocery.grocery, {}, opts) as Promise<
      {
        ingredientId: string;
        source: "manual" | "skip" | "override";
        manualQuantity: { quantity: number; unit: string } | null;
        buyQuantityG: number | null;
      }[]
    >,
```
```ts
  const overrideById = new Map(
    groceryRows
      .filter((g) => g.buyQuantityG != null)
      .map((g) => [g.ingredientId, g.buyQuantityG] as const),
  );

  const needs = needsRaw.map((n) => {
    const c = info.get(n.ingredientId);
    return {
      ...n,
      category: c?.category ?? null,
      canonicalUnitKind: c?.canonicalUnitKind ?? null,
      buyQuantityG: resolveBuyQuantity({
        override: overrideById.get(n.ingredientId) ?? null,
        restockCanonical: restockCanonicalFor(c),
        needAmount: n.amount,
        manualCanonical: null,
      }),
    };
  });
  const manual = manualRows.map((m) => {
    const c = info.get(m.ingredientId);
    const cInfo = catalogInfo(c);
    return {
      ingredientId: m.ingredientId,
      source: "manual" as const,
      manualQuantity: m.manualQuantity,
      name: c?.name ?? m.ingredientId,
      canonicalUnitKind: c?.canonicalUnitKind ?? null,
      category: c?.category ?? null,
      buyQuantityG: resolveBuyQuantity({
        override: m.buyQuantityG,
        restockCanonical: restockCanonicalFor(c),
        needAmount: null,
        manualCanonical:
          c && cInfo && m.manualQuantity
            ? restockToCanonical(m.manualQuantity, cInfo, c.name)
            : null,
      }),
    };
  });
```
(`needsRaw` filtering already excludes skip rows; keep that line as-is.)
5. `getMenuData` — pass cover/meta through:
```ts
    return {
      recipeId: p.recipeId,
      scale: p.scale,
      coverage: p.coverage,
      title: d?.title ?? "Untitled recipe",
      slug: d?.slug ?? null,
      coverImage: d?.coverImage ?? null,
      prepTime: d?.prepTime ?? null,
      cookTime: d?.cookTime ?? null,
      servings: d?.servings ?? null,
      optionalIngredients: (d?.optionalIngredients ?? []).map((o) => ({
        id: o.id,
        name: o.name ?? o.id,
      })),
    };
```

- [ ] **Step 3: Update `kitchen-data.test.ts`**

Update the mocked Convex/Sanity responses to the new shapes (grocery rows gain `buyQuantityG`, pantry rows lose `restockOverride`) and assert the new behavior. Arrange blocks must follow the file's existing mocking pattern (it already mocks `convex/nextjs` `fetchQuery` and the Sanity client `fetch` — mirror an existing test's arrange block exactly). Add at minimum these two tests with these exact assertions:

```ts
it("getShopData resolves a buy quantity from override, then restock, then need", async () => {
  // Arrange (file's existing mock pattern):
  // - plan: one recipe needing "a" 240g, "b" 240g, "c" 239.2g (scale 1)
  // - pantry: empty
  // - grocery: [{ ingredientId: "a", source: "override", manualQuantity: null, buyQuantityG: 500 }]
  // - catalog docs: "a" and "c" mass-kind with restockQuantity null;
  //   "b" mass-kind with restockQuantity { quantity: 1, unit: "lb" }
  const { needs } = await getShopData();
  const byId = new Map(needs.map((n) => [n.ingredientId, n.buyQuantityG]));
  expect(byId.get("a")).toBe(500);  // override wins
  expect(byId.get("b")).toBe(454);  // 1 lb → 453.59 g → ceil
  expect(byId.get("c")).toBe(240);  // need 239.2 → ceil
});

it("getPantryData flags items that already have a manual grocery row", async () => {
  // Arrange: pantry rows for "a" and "b";
  // grocery: [{ ingredientId: "a", source: "manual", manualQuantity: null, buyQuantityG: null }]
  const rows = await getPantryData();
  expect(rows.find((r) => r.ingredientId === "a")?.onList).toBe(true);
  expect(rows.find((r) => r.ingredientId === "b")?.onList).toBe(false);
});
```
TDD here is: write these two tests first, see them fail, then apply Step 1–2 edits.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/app/actions/kitchen-data.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sanity/lib/kitchen-queries.ts src/app/actions/kitchen-data.ts src/app/actions/kitchen-data.test.ts
git commit -m "feat: server data resolves buy quantities; menu query gains cover/meta"
```

---

### Task 11: Server actions — markBought(buyQuantityG), setBuyQuantity, depletePantryItem

**Files:**
- Modify: `src/app/actions/kitchen-actions.ts`
- Test: `src/app/actions/kitchen-actions.test.ts`

- [ ] **Step 1: Write/adjust failing tests**

In `src/app/actions/kitchen-actions.test.ts` (it mocks `convex/nextjs` fetchMutation/fetchQuery — follow the existing arrange style):

```ts
it("markBought adds the buy quantity and removes the grocery row", async () => {
  await markBought("ing-1", 500);
  expect(fetchMutation).toHaveBeenCalledWith(
    api.pantry.adjustPantry, { ingredientId: "ing-1", deltaG: 500 }, expect.anything(),
  );
  expect(fetchMutation).toHaveBeenCalledWith(
    api.grocery.removeBought, { ingredientId: "ing-1" }, expect.anything(),
  );
});

it("markBought with null skips the pantry write but still clears the row", async () => {
  await markBought("ing-1", null);
  expect(fetchMutation).not.toHaveBeenCalledWith(
    api.pantry.adjustPantry, expect.anything(), expect.anything(),
  );
  expect(fetchMutation).toHaveBeenCalledWith(
    api.grocery.removeBought, { ingredientId: "ing-1" }, expect.anything(),
  );
});

it("markBought rejects a non-positive or fractional quantity", async () => {
  await expect(markBought("ing-1", 0)).rejects.toThrow();
  await expect(markBought("ing-1", 2.5)).rejects.toThrow();
});

it("setBuyQuantity forwards to the grocery mutation", async () => {
  await setBuyQuantity("ing-1", 473);
  expect(fetchMutation).toHaveBeenCalledWith(
    api.grocery.setBuyQuantity, { ingredientId: "ing-1", buyQuantityG: 473 }, expect.anything(),
  );
});

it("depletePantryItem forwards to pantry.depleteItem", async () => {
  await depletePantryItem("ing-1");
  expect(fetchMutation).toHaveBeenCalledWith(
    api.pantry.depleteItem, { ingredientId: "ing-1" }, expect.anything(),
  );
});
```

Also update any existing tests that call `markBought("id")` (one arg) or `setRestockOverride` — the former gains an explicit quantity arg, the latter is deleted.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/app/actions/kitchen-actions.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `src/app/actions/kitchen-actions.ts`:

1. REPLACE `markBought` (lines 68-87) with:
```ts
/**
 * Check an item off the list: add the resolved buy quantity (canonical, whole
 * number) to the pantry and drop the item's manual/override row. A null
 * quantity means nothing resolvable was known — the row clears with no pantry
 * write.
 */
export async function markBought(ingredientId: string, buyQuantityG: number | null) {
  await requireMember();
  if (buyQuantityG != null && (!Number.isInteger(buyQuantityG) || buyQuantityG <= 0)) {
    throw new Error("Buy quantity must be a positive whole number");
  }
  const opts = await tokenOpts();
  if (buyQuantityG != null) {
    await fetchMutation(api.pantry.adjustPantry, { ingredientId, deltaG: buyQuantityG }, opts);
  }
  await fetchMutation(api.grocery.removeBought, { ingredientId }, opts);
  await reconcileStale(opts);
  revalidate();
}
```
2. ADD:
```ts
export async function setBuyQuantity(ingredientId: string, buyQuantityG: number) {
  await requireMember();
  await fetchMutation(api.grocery.setBuyQuantity, { ingredientId, buyQuantityG }, await tokenOpts());
  revalidate();
}

/** "Out of it" — remove the pantry row. Undo is a client-side re-set. */
export async function depletePantryItem(ingredientId: string) {
  await requireMember();
  await fetchMutation(api.pantry.depleteItem, { ingredientId }, await tokenOpts());
  revalidate();
}
```
3. DELETE `setRestockOverride` (lines 151-158).
4. Rename `reconcileSkips` → `reconcileStale`, clearing skip AND override rows (update all four call sites: `removeFromPlan`, `markBought`, `cook`, `setPantryQuantity`). Replace the function body:
```ts
/**
 * Clear `skip` and `override` rows whose ingredient no longer has a positive
 * plan need (e.g. the recipe was unplanned or the pantry was stocked).
 * Recomputes needs server-side.
 */
async function reconcileStale(opts: { token?: string }) {
  const [planRows, pantryRows, groceryRows] = await Promise.all([
    fetchQuery(api.plan.plan, {}, opts) as Promise<{ recipeId: string; scale: number }[]>,
    fetchQuery(api.pantry.pantry, {}, opts) as Promise<PantryRow[]>,
    fetchQuery(api.grocery.grocery, {}, opts) as Promise<
      { ingredientId: string; source: "manual" | "skip" | "override" }[]
    >,
  ]);
  const staleCandidates = groceryRows
    .filter((g) => g.source === "skip" || g.source === "override")
    .map((g) => g.ingredientId);
  if (staleCandidates.length === 0) return;

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
  const stale = staleCandidates.filter((id) => !neededIds.has(id));
  if (stale.length > 0) {
    await fetchMutation(api.grocery.clearStale, { ingredientIds: stale }, opts);
  }
}
```
5. Update the local `PantryRow` type (line 35) to `{ ingredientId: string; quantityG: number }` and remove the now-unused imports: `INGREDIENT_RESTOCK_QUERY`, `IngredientRestockDoc`, `toIngredientInfo`, `restockToCanonical` (check with the linter — `client`/`reader` are still used by `reconcileStale` and `cook`).

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/app/actions/kitchen-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/kitchen-actions.ts src/app/actions/kitchen-actions.test.ts
git commit -m "feat: buy-quantity-aware markBought, setBuyQuantity, depletePantryItem"
```

---

### Task 12: Toast — multiple actions

**Files:**
- Modify: `src/components/toast.tsx`

- [ ] **Step 1: Implement (UI-first; behavior is asserted via pantry-view tests in Task 14)**

In `src/components/toast.tsx`:

1. Extend the input type:
```ts
type ToastAction = { label: string; onAction: () => void };
type ToastInput = {
  message: string;
  /** One or more actions (e.g. Undo · Add to list). */
  actions?: ToastAction[];
  /** Back-compat single action. */
  actionLabel?: string;
  onAction?: () => void;
};
```
2. In the render, normalize and map. Replace the `{t.actionLabel ? (...) : null}` block with:
```tsx
{(t.actions ?? (t.actionLabel ? [{ label: t.actionLabel, onAction: t.onAction ?? (() => {}) }] : [])).map(
  (a) => (
    <button
      key={a.label}
      type="button"
      onClick={() => {
        a.onAction();
        dismiss(t.id);
      }}
      className="kicker text-clay-wash underline-offset-2 hover:underline"
    >
      {a.label}
    </button>
  ),
)}
```

- [ ] **Step 2: Verify nothing broke**

Run: `npx vitest run src/components`
Expected: existing component suites that mock `useToast` still pass (shop/pantry/menu suites may already be red from earlier API changes — only confirm no NEW failures are caused by toast.tsx; the full reconciliation lands in Tasks 13–15).

- [ ] **Step 3: Commit**

```bash
git add src/components/toast.tsx
git commit -m "feat: toast supports multiple actions"
```

---

### Task 13: Shop UI — one mode, quiet rows, add-on-top

**Files:**
- Rewrite: `src/components/shop-view.tsx`, `src/components/shop-item-row.tsx`
- Test: `src/components/shop-view.test.tsx` (rewrite)

- [ ] **Step 1: Rewrite `shop-item-row.tsx`**

```tsx
"use client";

import { useState } from "react";
import {
  shopItemMetaLabel,
  type ShopItem,
} from "@/lib/kitchen/shop-grouping";
import {
  formatCanonicalAmount,
  pantryNudgeStep,
} from "@/lib/kitchen/format-amount";
import { CheckBox } from "@/components/check-box";

export function ShopItemRow({
  item,
  checked,
  expanded,
  onBuy,
  onDismiss,
  onToggleExpand,
  onSetBuyQuantity,
}: {
  item: ShopItem;
  checked: boolean;
  expanded: boolean;
  onBuy: () => void;
  onDismiss: () => void;
  onToggleExpand: () => void;
  onSetBuyQuantity: (next: number) => void;
}) {
  const meta = checked
    ? item.buyQuantityG != null
      ? `added ${formatCanonicalAmount(item.buyQuantityG, item.canonicalUnitKind)} to pantry`
      : "checked off"
    : shopItemMetaLabel(item);
  const editable = !checked && item.buyQuantityG != null;

  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-terracotta/15 py-2.5">
      <CheckBox checked={checked} onChange={checked ? () => {} : onBuy} label={`Got ${item.name}`} />
      <div className="min-w-0 flex-1">
        <span className={`block text-ink ${checked ? "text-ink-soft line-through" : ""}`}>
          {item.name}
        </span>
        {meta ? (
          editable ? (
            <button
              type="button"
              onClick={onToggleExpand}
              aria-expanded={expanded}
              aria-label={`Adjust buy quantity for ${item.name}`}
              className="text-sm text-ink-soft hover:text-terracotta"
            >
              {meta}
            </button>
          ) : (
            <span className="block text-sm text-ink-soft">{meta}</span>
          )
        ) : null}
      </div>
      {!checked ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={`Won't buy ${item.name}`}
          className="kicker text-ink-soft hover:text-terracotta"
        >
          Won&rsquo;t buy
        </button>
      ) : null}
      {expanded && editable && item.buyQuantityG != null ? (
        <BuyQuantityEditor
          name={item.name}
          value={item.buyQuantityG}
          kind={item.canonicalUnitKind}
          onCommit={onSetBuyQuantity}
        />
      ) : null}
    </li>
  );
}

function BuyQuantityEditor({
  name,
  value,
  kind,
  onCommit,
}: {
  name: string;
  value: number;
  kind: ShopItem["canonicalUnitKind"];
  onCommit: (next: number) => void;
}) {
  const step = pantryNudgeStep(kind);
  const [draft, setDraft] = useState(String(value));

  // Keep the input in sync with the optimistic parent value.
  const synced = String(value);
  const [lastSynced, setLastSynced] = useState(synced);
  if (synced !== lastSynced) {
    setLastSynced(synced);
    setDraft(synced);
  }

  const commit = (next: number) => {
    const rounded = Math.max(1, Math.round(next));
    setDraft(String(rounded));
    if (rounded !== value) onCommit(rounded);
  };

  return (
    <div className="flex basis-full items-center gap-2 pb-1 pl-9">
      <button
        type="button"
        onClick={() => commit(value - step)}
        aria-label={`Decrease buy quantity for ${name}`}
        className="kicker h-7 w-7 rounded-full border border-terracotta/40 text-terracotta hover:bg-terracotta-wash"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(Number(draft) || value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(Number(draft) || value);
          }
        }}
        aria-label={`Buy quantity for ${name}`}
        className="w-16 border-b border-ink/25 bg-transparent pb-1 text-right text-ink focus:border-terracotta"
      />
      <button
        type="button"
        onClick={() => commit(value + step)}
        aria-label={`Increase buy quantity for ${name}`}
        className="kicker h-7 w-7 rounded-full border border-terracotta/40 text-terracotta hover:bg-terracotta-wash"
      >
        +
      </button>
      <span className="editorial-aside text-sm text-ink-soft">adjust what you&rsquo;re buying</span>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `shop-view.tsx`**

```tsx
"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import {
  markBought,
  skipItem,
  removeManualItem,
  addShopItemByName,
  setBuyQuantity,
} from "@/app/actions/kitchen-actions";
import {
  buildShopItems,
  groupShopItems,
  type ShopItem,
  type ShopNeed,
  type ShopManual,
} from "@/lib/kitchen/shop-grouping";
import { ShopItemRow } from "@/components/shop-item-row";
import { AddShopItem } from "@/components/add-shop-item";
import type { IngredientOption } from "@/sanity/types";

export function ShopView({
  needs,
  manual,
  catalog,
}: {
  needs: ShopNeed[];
  manual: ShopManual[];
  catalog: IngredientOption[];
}) {
  const [items, setItems] = useState(() => buildShopItems(needs, manual));
  const [bought, setBought] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  // Ref guard prevents double-buy from rapid clicks before React flushes state.
  const buyingRef = useRef<Set<string>>(new Set());

  const groups = useMemo(() => groupShopItems(items), [items]);
  const total = items.length;
  const doneCount = Math.min(bought.size, total);

  const act = (action: () => Promise<unknown>, revert: () => void) => {
    setError(null);
    start(async () => {
      try {
        await action();
      } catch {
        revert();
        setError("Couldn't save that — please try again.");
      }
    });
  };

  const patchItem = (id: string, next: Partial<ShopItem>) =>
    setItems((xs) => xs.map((x) => (x.ingredientId === id ? { ...x, ...next } : x)));

  // One behavior: check → pantry write; row stays, crossed out, until cleared.
  const buy = (item: ShopItem) => {
    const id = item.ingredientId;
    if (bought.has(id) || buyingRef.current.has(id)) return;
    buyingRef.current = new Set(buyingRef.current).add(id);
    setBought((b) => new Set(b).add(id));
    setExpanded((e) => (e === id ? null : e));
    act(
      () => markBought(id, item.buyQuantityG),
      () => {
        buyingRef.current = (() => { const n = new Set(buyingRef.current); n.delete(id); return n; })();
        setBought((b) => { const n = new Set(b); n.delete(id); return n; });
      },
    );
  };

  const dismiss = (id: string, source: "need" | "manual") => {
    const snapshot = items;
    setItems((xs) => xs.filter((x) => x.ingredientId !== id));
    act(
      () => (source === "manual" ? removeManualItem(id) : skipItem(id)),
      () => setItems(snapshot),
    );
  };

  const changeBuyQuantity = (item: ShopItem, next: number) => {
    const prev = item.buyQuantityG;
    patchItem(item.ingredientId, { buyQuantityG: next });
    act(
      () => setBuyQuantity(item.ingredientId, next),
      () => patchItem(item.ingredientId, { buyQuantityG: prev }),
    );
  };

  const clearChecked = () => {
    setItems((xs) => xs.filter((x) => !bought.has(x.ingredientId)));
    setBought(new Set());
    buyingRef.current = new Set();
  };

  const add = (name: string) => {
    act(
      async () => {
        const { ingredientId } = await addShopItemByName(name);
        setItems((xs) =>
          xs.some((x) => x.ingredientId === ingredientId)
            ? xs
            : [
                ...xs,
                {
                  ingredientId,
                  name,
                  category: null,
                  optional: false,
                  source: "manual" as const,
                  amount: null,
                  canonicalUnitKind: null,
                  manualQuantity: null,
                  buyQuantityG: null,
                },
              ],
        );
        toast({ message: `Added ${name}` });
      },
      () => {},
    );
  };

  const empty = total === 0;

  return (
    <div aria-busy={pending}>
      <div className="mt-6">
        <span className="kicker text-ink-soft" aria-live="polite">
          {doneCount > 0
            ? `${doneCount} of ${total} in the basket`
            : `${total} ${total === 1 ? "item" : "items"}`}
        </span>
        {!empty ? (
          <div
            className="mt-3 h-1 w-full overflow-hidden rounded-full bg-clay-wash"
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={total}
          >
            <div
              className="h-full bg-terracotta transition-all"
              style={{ width: total ? `${(doneCount / total) * 100}%` : "0%" }}
            />
          </div>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-terracotta-deep">
          {error}
        </p>
      ) : null}

      <AddShopItem catalog={catalog} onAdd={add} />

      {empty ? (
        <p className="mt-6 text-ink-soft">
          Your shopping list is empty — plan some recipes or add an item above.
        </p>
      ) : (
        <>
          <div className="mt-4 space-y-6">
            {groups.map((group) => (
              <section key={group.key} aria-labelledby={`group-${group.key}`}>
                <h2 id={`group-${group.key}`} className="kicker text-terracotta">
                  {group.label}
                </h2>
                <ul className="mt-2">
                  {group.items.map((item) => (
                    <ShopItemRow
                      key={item.ingredientId}
                      item={item}
                      checked={bought.has(item.ingredientId)}
                      expanded={expanded === item.ingredientId}
                      onBuy={() => buy(item)}
                      onDismiss={() => dismiss(item.ingredientId, item.source)}
                      onToggleExpand={() =>
                        setExpanded((e) => (e === item.ingredientId ? null : item.ingredientId))
                      }
                      onSetBuyQuantity={(next) => changeBuyQuantity(item, next)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {doneCount > 0 ? (
            <div className="mt-6 text-right">
              <button
                type="button"
                onClick={clearChecked}
                className="kicker text-ink-soft underline-offset-2 hover:text-terracotta hover:underline"
              >
                Clear checked-off items
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
```

Note: `AddShopItem` keeps its own `mt-6`; it now renders above the groups. No change needed in `add-shop-item.tsx`.

- [ ] **Step 3: Rewrite the behavior tests**

Replace `src/components/shop-view.test.tsx` body (keep mock scaffolding; add `setBuyQuantity: vi.fn()` to the hoisted actions and give NEEDS/MANUAL literals `buyQuantityG` values — e.g. beef `buyQuantityG: 500`, parsley `buyQuantityG: 10`, napkins `buyQuantityG: null`):

```ts
describe("ShopView", () => {
  it("renders category groups in store order with optional last", () => { /* keep as-is */ });

  it("shows the add-item field above the list", () => {
    render(<ShopView needs={NEEDS} manual={MANUAL} catalog={CATALOG} />);
    const input = screen.getByLabelText("Add a grocery item");
    const firstGroup = screen.getAllByRole("heading", { level: 2 })[0];
    expect(input.compareDocumentPosition(firstGroup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("checking an item calls markBought with its buy quantity and crosses it out in place", async () => {
    const user = userEvent.setup();
    render(<ShopView needs={NEEDS} manual={MANUAL} catalog={CATALOG} />);
    await user.click(screen.getByLabelText("Got beef"));
    expect(actions.markBought).toHaveBeenCalledWith("beef", 500);
    expect(screen.getByText("beef")).toBeInTheDocument(); // still visible
    expect(screen.getByText(/added 500 g to pantry/)).toBeInTheDocument();
    expect(screen.getByText(/1 of 3 in the basket/)).toBeInTheDocument();
  });

  it("checking an unresolvable item passes null", async () => {
    const user = userEvent.setup();
    render(<ShopView needs={NEEDS} manual={MANUAL} catalog={CATALOG} />);
    await user.click(screen.getByLabelText("Got napkins"));
    expect(actions.markBought).toHaveBeenCalledWith("napkins", null);
    expect(screen.getByText("checked off")).toBeInTheDocument();
  });

  it("always shows the progress bar (no shopping mode button)", () => {
    render(<ShopView needs={NEEDS} manual={MANUAL} catalog={CATALOG} />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start shopping/ })).not.toBeInTheDocument();
  });

  it("clear checked-off removes crossed-out rows", async () => {
    const user = userEvent.setup();
    render(<ShopView needs={NEEDS} manual={MANUAL} catalog={CATALOG} />);
    await user.click(screen.getByLabelText("Got beef"));
    await user.click(screen.getByRole("button", { name: "Clear checked-off items" }));
    expect(screen.queryByText("beef")).not.toBeInTheDocument();
  });

  it("uses the Won't buy label for both need and manual items", async () => {
    const user = userEvent.setup();
    render(<ShopView needs={NEEDS} manual={MANUAL} catalog={CATALOG} />);
    await user.click(screen.getByLabelText("Won't buy beef"));
    expect(actions.skipItem).toHaveBeenCalledWith("beef");
    await user.click(screen.getByLabelText("Won't buy napkins"));
    expect(actions.removeManualItem).toHaveBeenCalledWith("napkins");
  });

  it("expanding the meta line and nudging commits a new buy quantity", async () => {
    const user = userEvent.setup();
    render(<ShopView needs={NEEDS} manual={MANUAL} catalog={CATALOG} />);
    await user.click(screen.getByLabelText("Adjust buy quantity for beef"));
    await user.click(screen.getByLabelText("Increase buy quantity for beef"));
    expect(actions.setBuyQuantity).toHaveBeenCalledWith("beef", 510);
  });

  it("adding a catalog name calls addShopItemByName", async () => { /* keep as-is */ });
  it("offers create-if-missing for an unknown name", async () => { /* keep as-is */ });
});
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/components/shop-view.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/shop-view.tsx src/components/shop-item-row.tsx src/components/shop-view.test.tsx
git commit -m "feat: shop — one check-off mode, add-on-top, editable buy quantities, Won't buy"
```

---

### Task 14: Pantry UI — grouped ledger with cart/X actions

**Files:**
- Rewrite: `src/components/pantry-row.tsx`, `src/components/pantry-view.tsx`
- Modify: `src/app/(site)/pantry/page.tsx`
- Test: `src/components/pantry-view.test.tsx` (rewrite)

- [ ] **Step 1: Rewrite `pantry-row.tsx`**

```tsx
"use client";

import { useState } from "react";
import {
  formatCanonicalAmount,
  canonicalUnitLabel,
  pantryNudgeStep,
  type DisplayKind,
} from "@/lib/kitchen/format-amount";

export type PantryRowData = {
  ingredientId: string;
  name: string;
  quantityG: number;
  canonicalUnitKind: DisplayKind;
  category: string | null;
  /** A manual grocery row already exists — cart action shows as added. */
  onList: boolean;
};

export function PantryRow({
  row,
  onSetQuantity,
  onAddToList,
  onDeplete,
}: {
  row: PantryRowData;
  onSetQuantity: (next: number) => void;
  onAddToList: () => void;
  onDeplete: () => void;
}) {
  const unit = canonicalUnitLabel(row.canonicalUnitKind);
  const step = pantryNudgeStep(row.canonicalUnitKind);
  const [draft, setDraft] = useState(String(row.quantityG));

  // Keep the input in sync when the parent's optimistic value changes.
  const synced = String(row.quantityG);
  const [lastSynced, setLastSynced] = useState(synced);
  if (synced !== lastSynced) {
    setLastSynced(synced);
    setDraft(synced);
  }

  const commit = (value: number) => {
    const next = Math.max(0, Math.round(value));
    onSetQuantity(next);
    setDraft(String(next));
  };

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-2 border-b border-terracotta/15 py-2">
      <span className="truncate text-ink" title={row.name}>
        {row.name}
      </span>

      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => commit(row.quantityG - step)}
          aria-label={`Decrease ${row.name}`}
          className="kicker h-7 w-7 rounded-full border border-terracotta/40 text-terracotta hover:bg-terracotta-wash"
        >
          −
        </button>
        <label className="flex items-center gap-1">
          <span className="sr-only">{row.name} quantity</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit(Number(draft) || 0)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit(Number(draft) || 0);
              }
            }}
            aria-label={`${row.name} quantity in ${unit}`}
            className="w-16 border-b border-ink/25 bg-transparent pb-0.5 text-right text-ink focus:border-terracotta"
          />
          <span className="kicker w-10 text-ink-soft">{unit}</span>
        </label>
        <button
          type="button"
          onClick={() => commit(row.quantityG + step)}
          aria-label={`Increase ${row.name}`}
          className="kicker h-7 w-7 rounded-full border border-terracotta/40 text-terracotta hover:bg-terracotta-wash"
        >
          +
        </button>
      </div>

      <button
        type="button"
        onClick={onAddToList}
        disabled={row.onList}
        title={row.onList ? "Already on your grocery list" : "Add to grocery list"}
        aria-label={
          row.onList
            ? `${row.name} is already on your grocery list`
            : `Add ${row.name} to grocery list`
        }
        className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
          row.onList ? "text-clay" : "text-terracotta hover:bg-terracotta-wash"
        } disabled:cursor-default`}
      >
        <CartIcon />
      </button>

      <button
        type="button"
        onClick={onDeplete}
        title="Out of it — remove from pantry"
        aria-label={`Out of ${row.name} — remove from pantry`}
        className="flex h-7 w-7 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-terracotta-wash hover:text-terracotta"
      >
        <XIcon />
      </button>
    </li>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.25 w-4.25" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
      <path d="M3 4h2l2.6 12h10.2l2-8H6.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.25 w-4.25" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}
```

Note: `formatCanonicalAmount` is no longer used here — remove it from the import if the linter flags it.

- [ ] **Step 2: Rewrite `pantry-view.tsx`**

```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import {
  setPantryQuantity,
  addManualItem,
  depletePantryItem,
} from "@/app/actions/kitchen-actions";
import { groupPantryRows } from "@/lib/kitchen/pantry-grouping";
import { PantryRow, type PantryRowData } from "@/components/pantry-row";

export function PantryView({ rows: initialRows }: { rows: PantryRowData[] }) {
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  const groups = useMemo(() => groupPantryRows(rows), [rows]);

  const act = (
    action: () => Promise<unknown>,
    revert: () => void,
    onSuccess?: () => void,
  ) => {
    setError(null);
    start(async () => {
      try {
        await action();
        onSuccess?.();
      } catch {
        revert();
        setError("Couldn't save that — please try again.");
      }
    });
  };

  const patch = (id: string, next: Partial<PantryRowData>) =>
    setRows((rs) => rs.map((r) => (r.ingredientId === id ? { ...r, ...next } : r)));

  const setQuantity = (row: PantryRowData, next: number) => {
    const prev = row.quantityG;
    patch(row.ingredientId, { quantityG: next });
    act(
      () => setPantryQuantity(row.ingredientId, next),
      () => patch(row.ingredientId, { quantityG: prev }),
    );
  };

  const addToList = (row: PantryRowData) => {
    if (row.onList) return;
    patch(row.ingredientId, { onList: true });
    act(
      () => addManualItem(row.ingredientId),
      () => patch(row.ingredientId, { onList: false }),
      () => toast({ message: `${row.name} added to your list` }),
    );
  };

  const restore = (row: PantryRowData) => {
    setRows((rs) =>
      rs.some((r) => r.ingredientId === row.ingredientId) ? rs : [...rs, row],
    );
    act(
      () => setPantryQuantity(row.ingredientId, row.quantityG),
      () => setRows((rs) => rs.filter((r) => r.ingredientId !== row.ingredientId)),
    );
  };

  const deplete = (row: PantryRowData) => {
    const snapshot = rows;
    setRows((rs) => rs.filter((r) => r.ingredientId !== row.ingredientId));
    act(
      () => depletePantryItem(row.ingredientId),
      () => setRows(snapshot),
      () =>
        toast({
          message: `${row.name} removed`,
          actions: [
            { label: "Undo", onAction: () => restore(row) },
            { label: "Add to list", onAction: () => addToList({ ...row, onList: false }) },
          ],
        }),
    );
  };

  if (rows.length === 0) {
    return (
      <p className="mt-6 text-ink-soft">
        Your pantry is empty — check things off your shopping list and they&rsquo;ll land here.
      </p>
    );
  }

  return (
    <div aria-busy={pending}>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-terracotta-deep">
          {error}
        </p>
      ) : null}
      <div className="mt-4 space-y-6">
        {groups.map((group) => (
          <section key={group.key} aria-labelledby={`pantry-${group.key}`}>
            <h2 id={`pantry-${group.key}`} className="kicker text-terracotta">
              {group.label}
            </h2>
            <ul className="mt-1">
              {group.rows.map((row) => (
                <PantryRow
                  key={row.ingredientId}
                  row={row}
                  onSetQuantity={(next) => setQuantity(row, next)}
                  onAddToList={() => addToList(row)}
                  onDeplete={() => deplete(row)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update `pantry/page.tsx`**

Replace the `<PantryView …/>` props mapping and add the count kicker:

```tsx
      <header className="set set-1 mt-6">
        <p className="kicker text-terracotta">
          Your kitchen{rows.length ? ` · ${rows.length} ingredient${rows.length === 1 ? "" : "s"}` : ""}
        </p>
        <h1 className="editorial-display mt-2 text-4xl text-ink md:text-5xl">Pantry</h1>
        <div className="rule-draw mt-5 h-px w-full bg-terracotta/40" />
      </header>
      <PantryView
        rows={rows.map(({ ingredientId, name, quantityG, canonicalUnitKind, category, onList }) => ({
          ingredientId,
          name,
          quantityG,
          canonicalUnitKind,
          category,
          onList,
        }))}
      />
```

- [ ] **Step 4: Rewrite the behavior tests**

Replace `src/components/pantry-view.test.tsx` with (mocking pattern as before; mock `useToast` so the actions array is capturable):

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const actions = vi.hoisted(() => ({
  setPantryQuantity: vi.fn(),
  addManualItem: vi.fn(),
  depletePantryItem: vi.fn(),
}));
const toastSpy = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/kitchen-actions", () => actions);
vi.mock("@/components/toast", () => ({ useToast: () => toastSpy }));

import { PantryView } from "@/components/pantry-view";
import type { PantryRowData } from "@/components/pantry-row";

const ROWS: PantryRowData[] = [
  { ingredientId: "oil", name: "olive oil", quantityG: 740, canonicalUnitKind: "mass", category: "pantry", onList: false },
  { ingredientId: "garlic", name: "garlic", quantityG: 3, canonicalUnitKind: "count", category: "produce", onList: false },
  { ingredientId: "milk", name: "milk", quantityG: 500, canonicalUnitKind: "mass", category: "dairy", onList: true },
];

beforeEach(() => {
  Object.values(actions).forEach((m) => m.mockReset().mockResolvedValue(undefined));
  toastSpy.mockReset();
});

describe("PantryView", () => {
  it("groups rows by category in aisle order", () => {
    render(<PantryView rows={ROWS} />);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Produce", "Dairy", "Pantry"]);
  });

  it("nudging commits a whole-number quantity", async () => {
    const user = userEvent.setup();
    render(<PantryView rows={ROWS} />);
    await user.click(screen.getByLabelText("Increase garlic"));
    expect(actions.setPantryQuantity).toHaveBeenCalledWith("garlic", 4);
  });

  it("cart adds a manual grocery item and flips to added state", async () => {
    const user = userEvent.setup();
    render(<PantryView rows={ROWS} />);
    await user.click(screen.getByLabelText("Add garlic to grocery list"));
    expect(actions.addManualItem).toHaveBeenCalledWith("garlic");
    expect(screen.getByLabelText("garlic is already on your grocery list")).toBeDisabled();
  });

  it("cart is disabled for items already on the list", () => {
    render(<PantryView rows={ROWS} />);
    expect(screen.getByLabelText("milk is already on your grocery list")).toBeDisabled();
  });

  it("X depletes: row disappears and a toast offers Undo and Add to list", async () => {
    const user = userEvent.setup();
    render(<PantryView rows={ROWS} />);
    await user.click(screen.getByLabelText("Out of garlic — remove from pantry"));
    expect(actions.depletePantryItem).toHaveBeenCalledWith("garlic");
    expect(screen.queryByText("garlic")).not.toBeInTheDocument();
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "garlic removed",
        actions: [
          expect.objectContaining({ label: "Undo" }),
          expect.objectContaining({ label: "Add to list" }),
        ],
      }),
    );
  });

  it("Undo restores the row at its prior quantity", async () => {
    const user = userEvent.setup();
    render(<PantryView rows={ROWS} />);
    await user.click(screen.getByLabelText("Out of garlic — remove from pantry"));
    const { actions: toastActions } = toastSpy.mock.calls[0][0];
    toastActions.find((a: { label: string }) => a.label === "Undo").onAction();
    expect(actions.setPantryQuantity).toHaveBeenCalledWith("garlic", 3);
    expect(await screen.findByText("garlic")).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/components/pantry-view.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/pantry-view.tsx src/components/pantry-row.tsx "src/app/(site)/pantry/page.tsx" src/components/pantry-view.test.tsx
git commit -m "feat: pantry — grouped aligned ledger, cart/X actions, undo toast; restock UI removed"
```

---

### Task 15: Menu UI — editorial spread cards

**Files:**
- Rewrite: `src/components/menu-recipe-row.tsx`
- Modify: `src/components/menu-view.tsx`, `src/app/(site)/menu/page.tsx`
- Test: `src/components/menu-view.test.tsx` (update)

- [ ] **Step 1: Rewrite `menu-recipe-row.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import type { SanityImageSource } from "@sanity/image-url";
import { CheckBox } from "@/components/check-box";
import { RecipeCover } from "@/components/recipe-cover";
import { coverTransitionName } from "@/lib/view-transition";
import { totalTime } from "@/lib/format";

export type MenuRow = {
  recipeId: string;
  title: string;
  slug: string | null;
  coverImage: SanityImageSource | null;
  prepTime: number | null;
  cookTime: number | null;
  servings: number | null;
  scale: number;
  coverage: {
    cookable: boolean;
    missingRequired: number;
    missing: { ingredientId: string; name: string }[];
  };
  optionalIngredients: { id: string; name: string }[];
};

export function MenuRecipeRow({
  row,
  scale,
  onScale,
  onRemove,
  onMadeIt,
  onAddMissing,
  addedMissing,
}: {
  row: MenuRow;
  scale: number;
  onScale: (next: number) => void;
  onRemove: () => void;
  onMadeIt: (usedOptionalIds: string[]) => void;
  onAddMissing: (ingredientId: string, name: string) => void;
  /** Ingredient ids already added to the list from this card. */
  addedMissing: Set<string>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [used, setUsed] = useState<Set<string>>(() => new Set());

  const time = totalTime(row.prepTime, row.cookTime);
  const meta = [
    time,
    row.servings ? `serves ${row.servings}` : null,
    scale !== 1 ? `scale ×${scale}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const toggle = (id: string) =>
    setUsed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const confirm = () => {
    onMadeIt([...used]);
    setConfirming(false);
    setUsed(new Set());
  };

  const cover = (
    <div
      className="aspect-[2.2/1] overflow-hidden border border-ink/15"
      style={{ viewTransitionName: coverTransitionName(row.recipeId) }}
    >
      <RecipeCover
        image={row.coverImage}
        title={row.title}
        sizes="(min-width: 672px) 672px, 100vw"
      />
    </div>
  );

  return (
    <li className="border-b border-terracotta/15 py-6 last:border-b-0">
      {row.slug ? (
        <Link href={`/recipe/${row.slug}`} aria-label={row.title} className="block">
          {cover}
        </Link>
      ) : (
        cover
      )}

      <h2 className="editorial-display mt-3 text-2xl text-ink">
        {row.slug ? (
          <Link href={`/recipe/${row.slug}`} className="hover:text-terracotta">
            {row.title}
          </Link>
        ) : (
          row.title
        )}
      </h2>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        {meta ? <span className="kicker text-ink-soft">{meta}</span> : null}
        {row.coverage.cookable ? (
          <span className="kicker text-clay">Ready to cook</span>
        ) : row.coverage.missingRequired > 0 ? (
          <button
            type="button"
            onClick={() => setShowMissing((v) => !v)}
            aria-expanded={showMissing}
            className="kicker text-terracotta underline-offset-2 hover:underline"
          >
            Missing {row.coverage.missingRequired} — {showMissing ? "hide" : "view"}
          </button>
        ) : null}
      </div>

      {showMissing && row.coverage.missing.length > 0 ? (
        <ul className="mt-2 space-y-1.5 rounded-lg bg-clay-wash/40 p-3">
          {row.coverage.missing.map((m) => (
            <li key={m.ingredientId} className="flex items-center justify-between gap-3">
              <span className="text-ink">{m.name}</span>
              {addedMissing.has(m.ingredientId) ? (
                <span className="kicker text-clay">On the list ✓</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onAddMissing(m.ingredientId, m.name)}
                  className="kicker text-terracotta hover:text-terracotta-deep"
                >
                  Add to list
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => setConfirming((v) => !v)}
          className="kicker rounded-full bg-terracotta px-4 py-1.5 text-paper hover:bg-terracotta-deep"
        >
          Made it
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onScale(scale - 1)}
            aria-label={`Decrease servings for ${row.title}`}
            className="kicker h-8 w-8 rounded-full border border-terracotta/40 text-terracotta hover:bg-terracotta-wash"
          >
            −
          </button>
          <span className="kicker w-8 text-center text-ink" aria-label={`Serving scale ${scale}x`}>
            ×{scale}
          </span>
          <button
            type="button"
            onClick={() => onScale(scale + 1)}
            aria-label={`Increase servings for ${row.title}`}
            className="kicker h-8 w-8 rounded-full border border-terracotta/40 text-terracotta hover:bg-terracotta-wash"
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${row.title} from the menu`}
          className="kicker text-ink-soft hover:text-terracotta"
        >
          Remove
        </button>
      </div>

      {confirming ? (
        <div className="mt-3 rounded-lg bg-clay-wash/40 p-3">
          {row.optionalIngredients.length > 0 ? (
            <>
              <p className="kicker text-ink-soft">Which optional ingredients did you use?</p>
              <ul className="mt-2 space-y-2">
                {row.optionalIngredients.map((o) => (
                  <li key={o.id} className="flex items-center gap-2">
                    <CheckBox
                      checked={used.has(o.id)}
                      onChange={() => toggle(o.id)}
                      label={`Used ${o.name}`}
                    />
                    <span className="text-ink">{o.name}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-ink-soft">Mark as made? This uses up the ingredients.</p>
          )}
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={confirm}
              className="kicker rounded-full bg-terracotta px-4 py-1.5 text-paper hover:bg-terracotta-deep"
            >
              Confirm — made it
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setUsed(new Set());
              }}
              className="kicker text-ink-soft hover:text-terracotta"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
```

- [ ] **Step 2: Update `menu-view.tsx`**

Add the add-missing handler and empty-state link. Three edits:

1. Import `addManualItem` alongside the others:
```ts
import { setScale, removeFromPlan, cook, addManualItem } from "@/app/actions/kitchen-actions";
```
2. Add state + handler inside `MenuView` (after `madeIt`):
```ts
  const [addedMissing, setAddedMissing] = useState<Set<string>>(() => new Set());

  const addMissing = (ingredientId: string, name: string) => {
    setAddedMissing((s) => new Set(s).add(ingredientId));
    act(
      () => addManualItem(ingredientId),
      () => setAddedMissing((s) => { const n = new Set(s); n.delete(ingredientId); return n; }),
      () => toast({ message: `${name} added to your list` }),
    );
  };
```
3. Pass to the row, and update the empty state:
```tsx
          <MenuRecipeRow
            key={row.recipeId}
            row={row}
            scale={scaleOf(row)}
            onScale={(next) => changeScale(row, next)}
            onRemove={() => remove(row)}
            onMadeIt={(ids) => madeIt(row, ids)}
            onAddMissing={addMissing}
            addedMissing={addedMissing}
          />
```
```tsx
  if (visible.length === 0) {
    return (
      <p className="mt-6 text-ink-soft">
        Nothing on the menu yet —{" "}
        <Link href="/" className="text-terracotta hover:text-terracotta-deep">
          browse the collection
        </Link>{" "}
        and add a few recipes.
      </p>
    );
  }
```
(add `import Link from "next/link";` at the top.)

- [ ] **Step 3: Update `menu/page.tsx` kicker**

```tsx
        <p className="kicker text-terracotta">
          Cooking soon{rows.length ? ` · ${rows.length} recipe${rows.length === 1 ? "" : "s"}` : ""}
        </p>
```

- [ ] **Step 4: Update `menu-view.test.tsx`**

The `MenuRow` fixtures gain `coverImage: null, prepTime: 30, cookTime: 15, servings: 4` and `coverage` gains `missing` (e.g. `missing: [{ ingredientId: "i1", name: "butter" }]` where `missingRequired: 1`). Add `addManualItem: vi.fn()` to the hoisted action mocks. Add tests:

```tsx
it("shows time and servings meta on the card", () => {
  render(<MenuView rows={ROWS} />);
  expect(screen.getByText(/serves 4/)).toBeInTheDocument();
});

it("expands the missing list and adds an ingredient to the grocery list", async () => {
  const user = userEvent.setup();
  render(<MenuView rows={ROWS} />);
  await user.click(screen.getByRole("button", { name: /Missing 1 — view/ }));
  await user.click(screen.getByRole("button", { name: "Add to list" }));
  expect(actions.addManualItem).toHaveBeenCalledWith("i1");
  expect(screen.getByText("On the list ✓")).toBeInTheDocument();
});
```
Fix any existing assertions that referenced the old row layout (e.g. heading levels — titles are now `h2`).

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/components/menu-view.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/menu-recipe-row.tsx src/components/menu-view.tsx "src/app/(site)/menu/page.tsx" src/components/menu-view.test.tsx
git commit -m "feat: menu — editorial spread cards with cover, meta, expandable missing list"
```

---

### Task 16: Home tweaks — to-try mark + merged filter row

**Files:**
- Modify: `src/components/recipe-card.tsx:33-41`
- Modify: `src/components/filter-controls.tsx`
- Test: `src/components/recipe-card.test.tsx`, `src/components/filter-controls.test.tsx`

- [ ] **Step 1: recipe-card — show the To try mark even when rated**

In `recipe-card.tsx` replace the badge conditional (lines 33-41) with:

```tsx
        {approved ? (
          <span className="absolute left-3 top-3 inline-flex h-7 items-center rounded-full bg-paper px-2.5 shadow-sm">
            <JuneApprovedBadge />
          </span>
        ) : null}
        {recipe.toTry ? (
          <span className="kicker absolute right-3 top-3 inline-flex h-7 items-center rounded-full bg-paper px-2.5 text-terracotta shadow-sm">
            To try
          </span>
        ) : null}
```

Add a test to `recipe-card.test.tsx` (follow its existing fixture style):

```tsx
it("shows the To try mark even when the recipe is rated", () => {
  render(<RecipeCard recipe={{ ...BASE_RECIPE, toTry: true, ratingAvg: 4.5 }} />);
  expect(screen.getByText("To try")).toBeInTheDocument();
});
```

- [ ] **Step 2: filter-controls — merge Collection + Cookable into one row**

In `filter-controls.tsx`, delete the standalone `showCookable` block (lines 134-155) and fold it into the collection row (lines 86-105):

```tsx
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
```

Update `filter-controls.test.tsx`: any test that queried the cookable group by its visible label text now uses the group's aria-label (`screen.getByRole("group", { name: "What can I cook?" })`).

- [ ] **Step 3: Run to verify pass**

Run: `npx vitest run src/components/recipe-card.test.tsx src/components/filter-controls.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/recipe-card.tsx src/components/filter-controls.tsx src/components/recipe-card.test.tsx src/components/filter-controls.test.tsx
git commit -m "feat: home — persistent to-try mark, merged filter row"
```

---

### Task 17: Recipe header — ⋯ overflow for Edit/Share/Delete

**Files:**
- Create: `src/components/recipe-actions-menu.tsx`
- Modify: `src/app/(site)/recipe/[slug]/page.tsx:138-164`
- Test: `src/components/recipe-actions-menu.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `src/components/recipe-actions-menu.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/app/actions/recipe-actions", () => ({ deleteRecipe: vi.fn() }));

import { RecipeActionsMenu } from "@/components/recipe-actions-menu";

describe("RecipeActionsMenu", () => {
  it("hides Edit/Share/Delete behind the overflow button", async () => {
    const user = userEvent.setup();
    render(<RecipeActionsMenu slug="tacos" recipeId="r1" title="Tacos" />);
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/recipe/tacos/edit");
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("toggles closed again", async () => {
    const user = userEvent.setup();
    render(<RecipeActionsMenu slug="tacos" recipeId="r1" title="Tacos" />);
    const more = screen.getByRole("button", { name: "More actions" });
    await user.click(more);
    await user.click(more);
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/recipe-actions-menu.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/components/recipe-actions-menu.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { ShareButton } from "@/components/share-button";
import { DeleteRecipeButton } from "@/components/delete-recipe-button";

/**
 * Member-only overflow for the quieter recipe actions. Cook mode and the plan
 * toggle stay visible; Edit / Share / Delete live behind a ⋯ toggle so the
 * header reads as one clear hierarchy.
 */
export function RecipeActionsMenu({
  slug,
  recipeId,
  title,
}: {
  slug: string;
  recipeId: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span className="inline-flex flex-wrap items-center gap-x-5 gap-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="More actions"
        className="kicker text-ink-soft transition-colors hover:text-terracotta"
      >
        ⋯
      </button>
      {open ? (
        <>
          <Link
            href={`/recipe/${slug}/edit`}
            className="kicker text-terracotta hover:text-terracotta-deep"
          >
            Edit
          </Link>
          <ShareButton />
          <DeleteRecipeButton recipeId={recipeId} title={title} />
        </>
      ) : null}
    </span>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/components/recipe-actions-menu.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire into the recipe page**

In `src/app/(site)/recipe/[slug]/page.tsx`, replace the inner actions div (lines 147-163, the `<div className="flex flex-wrap items-center gap-x-5 gap-y-2">…</div>`) with:

```tsx
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {viewer.isMember ? (
              <AddToPlanButton
                recipeId={recipe._id}
                inPlan={Boolean(plannedIds?.includes(recipe._id))}
              />
            ) : null}
            {viewer.isMember ? (
              <RecipeActionsMenu
                slug={recipe.slug}
                recipeId={recipe._id}
                title={recipe.title}
              />
            ) : (
              <ShareButton />
            )}
          </div>
```
Add the import `import { RecipeActionsMenu } from "@/components/recipe-actions-menu";` and remove the now-unused imports of `DeleteRecipeButton` (and `ShareButton` only if the non-member branch above didn't keep it — it does, so keep `ShareButton`).

- [ ] **Step 6: Commit**

```bash
git add src/components/recipe-actions-menu.tsx src/components/recipe-actions-menu.test.tsx "src/app/(site)/recipe/[slug]/page.tsx"
git commit -m "feat: recipe header — Edit/Share/Delete behind overflow menu"
```

---

### Task 18: Full verification + review gates

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all suites pass. Fix any straggler (e.g. a test still importing `shopItemAmountLabel`, `setRestockOverride`, or `clearSkips`).

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. Common stragglers: unused imports in `kitchen-actions.ts` / `pantry-row.tsx`, the deleted `INGREDIENT_RESTOCK_QUERY` import.

- [ ] **Step 3: Manual smoke (dev server)**

Run `npm run dev`, then verify: Shop check-off crosses out in place and the pantry gains the buy amount; "Won't buy" on both item kinds; add-item field on top; Pantry grouped with aligned columns, cart adds to list, X removes with Undo/Add-to-list toast; Menu shows covers/meta, missing list expands and adds to the list; integer quantities everywhere.

- [ ] **Step 4: Commit any fixes, then review gates**

```bash
git add -A && git commit -m "fix: post-suite cleanups" # only if needed
```
Then run `/code-review` and address findings (apply small fixes; surface architecture/scope changes to Jacob first). Commit fixes. Then run `/security-review` as the final gate. Do NOT push or open a PR — report results and stop.

- [ ] **Step 5: Deployment note for the final report**

Remind Jacob: run `npx convex run migrations:roundPantryQuantities` against prod when deploying (idempotent; dev already done in Task 4).
