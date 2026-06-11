# Spec 2c-1 — Convex data layer (tables + mutations + queries) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the per-household Convex data layer for Spec 2's kitchen loop — `planRecipes`, `pantryItems`, `groceryItems` tables plus the transactional mutations and raw queries the loop needs — all guarded by `requireMembership` and verified with the `convex-test` harness. Mutations apply **given numeric amounts**; they never read Sanity (the server layer in 2c-2 computes amounts via the Spec 2b pure lib and calls these).

**Architecture:** Mirrors the established per-household Convex pattern in [convex/recipeState.ts](../../../convex/recipeState.ts) and [convex/ratings.ts](../../../convex/ratings.ts) (`requireMembership`/`getMembership` from [convex/lib/auth.ts](../../../convex/lib/auth.ts), upsert via a `by_household_*` index for structural uniqueness). Each domain (plan / pantry / grocery / cook) gets its own file. Plan-derived grocery **needs are computed in 2c-2**, not stored — `groceryItems` stores only `manual` additions and `skip` suppressions.

**Tech Stack:** Convex (`mutation`/`query`, `v` validators), `convex-test` + `@edge-runtime/vm` (see the harness note below), Vitest.

**Parent spec:** [docs/superpowers/specs/2026-06-11-cooking-with-june-spec-2-pantry-design.md](../specs/2026-06-11-cooking-with-june-spec-2-pantry-design.md) §7.

**convex-test harness (every `convex/*.test.ts`):** starts with these exact lines:
```ts
// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

async function member(t: ReturnType<typeof convexTest>, email: string) {
  const userId = await t.run(async (ctx) => ctx.db.insert("users", { email }));
  const as = t.withIdentity({ subject: userId });
  await as.mutation(api.households.createHousehold, { name: email });
  return as;
}
```
`*.test.ts` is excluded from `convex/tsconfig.json` already.

---

## File Structure

- `convex/schema.ts` — **modify**: add `planRecipes`, `pantryItems`, `groceryItems` tables + indexes.
- `convex/plan.ts` + `convex/plan.test.ts` — **create**: planned-recipe mutations + query.
- `convex/pantry.ts` + `convex/pantry.test.ts` — **create**: pantry mutations + query.
- `convex/grocery.ts` + `convex/grocery.test.ts` — **create**: manual/skip grocery mutations + query.
- `convex/cook.ts` + `convex/cook.test.ts` — **create**: the transactional cook mutation (deplete + made + unplan).

Each file owns one table's behavior; `cook.ts` spans pantry + recipeState + planRecipes because it is one transaction.

---

## Task 1: Schema — the three tables

**Files:**
- Modify: `convex/schema.ts`
- Test: `convex/schema.test.ts` (create — a convex-test that inserts + reads each table directly)

- [ ] **Step 1: Write the failing test**

`convex/schema.test.ts`:

```ts
// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

test("planRecipes / pantryItems / groceryItems tables accept rows", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const householdId = await ctx.db.insert("households", {
      name: "h",
      ownerUserId: await ctx.db.insert("users", { email: "x@example.com" }),
    });
    const userId = await ctx.db.insert("users", { email: "y@example.com" });

    const plan = await ctx.db.insert("planRecipes", {
      householdId,
      recipeId: "r1",
      scale: 2,
      addedAt: 1,
    });
    const pantry = await ctx.db.insert("pantryItems", {
      householdId,
      ingredientId: "i1",
      quantityG: 500,
      updatedAt: 1,
    });
    const grocery = await ctx.db.insert("groceryItems", {
      householdId,
      ingredientId: "i2",
      source: "manual",
      manualQuantity: { quantity: 2, unit: "lb" },
      addedByUserId: userId,
      createdAt: 1,
    });

    expect((await ctx.db.get(plan))?.scale).toBe(2);
    expect((await ctx.db.get(pantry))?.quantityG).toBe(500);
    expect((await ctx.db.get(grocery))?.source).toBe("manual");
  });
});

test("by_household_ingredient index is queryable on pantryItems", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const householdId = await ctx.db.insert("households", {
      name: "h",
      ownerUserId: await ctx.db.insert("users", { email: "z@example.com" }),
    });
    await ctx.db.insert("pantryItems", {
      householdId,
      ingredientId: "i1",
      quantityG: 10,
      updatedAt: 1,
    });
    const row = await ctx.db
      .query("pantryItems")
      .withIndex("by_household_ingredient", (q) =>
        q.eq("householdId", householdId).eq("ingredientId", "i1"),
      )
      .unique();
    expect(row?.quantityG).toBe(10);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- convex/schema.test.ts`
Expected: FAIL — tables/index not defined.

- [ ] **Step 3: Add the tables**

In `convex/schema.ts`, add these three table definitions inside `defineSchema({ ... })` (after `recipeNotes`):

```ts
  // Per-household planned recipes (recipeId is a Sanity _id string).
  planRecipes: defineTable({
    householdId: v.id("households"),
    recipeId: v.string(),
    scale: v.number(),
    addedAt: v.number(),
  })
    .index("by_household", ["householdId"])
    .index("by_household_recipe", ["householdId", "recipeId"]),

  // Per-household pantry stock. quantityG is the ingredient's canonical amount
  // (grams for mass/volume-kind, item count for count-kind).
  pantryItems: defineTable({
    householdId: v.id("households"),
    ingredientId: v.string(),
    quantityG: v.number(),
    restockOverride: v.optional(
      v.object({ quantity: v.number(), unit: v.string() }),
    ),
    updatedAt: v.number(),
  })
    .index("by_household", ["householdId"])
    .index("by_household_ingredient", ["householdId", "ingredientId"]),

  // Per-household grocery rows: manual additions (+) and skip suppressions (-).
  // Plan-derived needs are computed (not stored).
  groceryItems: defineTable({
    householdId: v.id("households"),
    ingredientId: v.string(),
    source: v.union(v.literal("manual"), v.literal("skip")),
    manualQuantity: v.optional(
      v.object({ quantity: v.number(), unit: v.string() }),
    ),
    addedByUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_household", ["householdId"])
    .index("by_household_ingredient", ["householdId", "ingredientId"]),
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- convex/schema.test.ts`
Expected: PASS. Then `npx convex dev --once` to confirm the schema deploys cleanly (reports "Schema validation complete" / no errors).

- [ ] **Step 5: Commit**

```bash
git add convex/schema.ts convex/schema.test.ts
git commit -m "feat(2c-1): planRecipes / pantryItems / groceryItems tables"
```

---

## Task 2: `plan.ts` — planned-recipe mutations + query

**Files:**
- Create: `convex/plan.ts`
- Test: `convex/plan.test.ts`

Behavior: `addToPlan(recipeId, scale)` upserts one row per (household, recipe) — re-adding updates the scale rather than duplicating. `removeFromPlan(recipeId)` deletes it. `setScale(recipeId, scale)` updates an existing row (no-op insert if absent — actually upsert for resilience). `plan()` returns the household's rows. Scale must be a positive finite number, else default to 1.

- [ ] **Step 1: Write the failing test**

`convex/plan.test.ts`:

```ts
// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

async function member(t: ReturnType<typeof convexTest>, email: string) {
  const userId = await t.run(async (ctx) => ctx.db.insert("users", { email }));
  const as = t.withIdentity({ subject: userId });
  await as.mutation(api.households.createHousehold, { name: email });
  return as;
}

test("addToPlan inserts one row and is idempotent on (household, recipe)", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.plan.addToPlan, { recipeId: "r1", scale: 2 });
  await a.mutation(api.plan.addToPlan, { recipeId: "r1", scale: 3 });
  const rows = await a.query(api.plan.plan, {});
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ recipeId: "r1", scale: 3 });
});

test("setScale updates the scale; removeFromPlan deletes the row", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.plan.addToPlan, { recipeId: "r1", scale: 1 });
  await a.mutation(api.plan.setScale, { recipeId: "r1", scale: 4 });
  expect((await a.query(api.plan.plan, {}))[0].scale).toBe(4);
  await a.mutation(api.plan.removeFromPlan, { recipeId: "r1" });
  expect(await a.query(api.plan.plan, {})).toHaveLength(0);
});

test("a non-positive scale defaults to 1", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.plan.addToPlan, { recipeId: "r1", scale: 0 });
  expect((await a.query(api.plan.plan, {}))[0].scale).toBe(1);
});

test("plan is scoped to the household and requires membership", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  const b = await member(t, "b@example.com");
  await a.mutation(api.plan.addToPlan, { recipeId: "r1", scale: 1 });
  expect(await b.query(api.plan.plan, {})).toHaveLength(0);
  await expect(
    t.mutation(api.plan.addToPlan, { recipeId: "r1", scale: 1 }),
  ).rejects.toThrow();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- convex/plan.test.ts`
Expected: FAIL — `api.plan` undefined.

- [ ] **Step 3: Implement**

`convex/plan.ts`:

```ts
import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getMembership } from "./lib/auth";
import { requireMembership } from "./lib/auth";

function normalizeScale(scale: number): number {
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

async function planRow(
  ctx: MutationCtx,
  householdId: Id<"households">,
  recipeId: string,
) {
  return await ctx.db
    .query("planRecipes")
    .withIndex("by_household_recipe", (q) =>
      q.eq("householdId", householdId).eq("recipeId", recipeId),
    )
    .unique();
}

export const plan = query({
  args: {},
  handler: async (ctx) => {
    const userId = await (async () => {
      const m = await getMembership(ctx, (await import("@convex-dev/auth/server")).getAuthUserId
        ? ((await (await import("@convex-dev/auth/server")).getAuthUserId(ctx)) as Id<"users"> | null)
        : null);
      return m;
    })();
    void userId;
    // Simpler: resolve membership directly.
    const membership = await resolveMembership(ctx);
    if (!membership) return [];
    const rows = await ctx.db
      .query("planRecipes")
      .withIndex("by_household", (q) => q.eq("householdId", membership.householdId))
      .collect();
    return rows.map((r) => ({ recipeId: r.recipeId, scale: r.scale, addedAt: r.addedAt }));
  },
});

export const addToPlan = mutation({
  args: { recipeId: v.string(), scale: v.number() },
  handler: async (ctx, { recipeId, scale }) => {
    const { householdId } = await requireMembership(ctx);
    const s = normalizeScale(scale);
    const existing = await planRow(ctx, householdId, recipeId);
    if (existing) {
      await ctx.db.patch(existing._id, { scale: s });
      return;
    }
    await ctx.db.insert("planRecipes", {
      householdId,
      recipeId,
      scale: s,
      addedAt: Date.now(),
    });
  },
});

export const setScale = mutation({
  args: { recipeId: v.string(), scale: v.number() },
  handler: async (ctx, { recipeId, scale }) => {
    const { householdId } = await requireMembership(ctx);
    const s = normalizeScale(scale);
    const existing = await planRow(ctx, householdId, recipeId);
    if (existing) {
      await ctx.db.patch(existing._id, { scale: s });
      return;
    }
    await ctx.db.insert("planRecipes", {
      householdId,
      recipeId,
      scale: s,
      addedAt: Date.now(),
    });
  },
});

export const removeFromPlan = mutation({
  args: { recipeId: v.string() },
  handler: async (ctx, { recipeId }) => {
    const { householdId } = await requireMembership(ctx);
    const existing = await planRow(ctx, householdId, recipeId);
    if (existing) await ctx.db.delete(existing._id);
  },
});
```

**NOTE for the implementer:** the `plan` query's membership resolution above is intentionally written awkwardly to flag a cleanup — replace it with the clean pattern used in `recipeState.mine`: import `getAuthUserId` from `@convex-dev/auth/server` and `getMembership` from `./lib/auth` at the top, then:
```ts
export const plan = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const m = await getMembership(ctx, userId);
    if (!m) return [];
    const rows = await ctx.db
      .query("planRecipes")
      .withIndex("by_household", (q) => q.eq("householdId", m.householdId))
      .collect();
    return rows.map((r) => ({ recipeId: r.recipeId, scale: r.scale, addedAt: r.addedAt }));
  },
});
```
Use THIS clean version (and delete the `resolveMembership`/awkward block + the unused `MutationCtx` import if not otherwise needed). `Date.now()` is allowed in Convex mutations (server runtime). `setScale` and `addToPlan` share an identical upsert body — extract a private `upsertScale(ctx, householdId, recipeId, s)` helper to keep it DRY.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- convex/plan.test.ts`
Expected: PASS. Then `npx convex dev --once` (clean).

- [ ] **Step 5: Commit**

```bash
git add convex/plan.ts convex/plan.test.ts
git commit -m "feat(2c-1): plan mutations (add/remove/setScale) + plan query"
```

---

## Task 3: `pantry.ts` — pantry mutations + query

**Files:**
- Create: `convex/pantry.ts`
- Test: `convex/pantry.test.ts`

Behavior:
- `adjustPantry(ingredientId, deltaG)` — add `deltaG` (may be negative) to the ingredient's `quantityG`, **clamped at 0**; upserts a row. Used by buy (positive) and cook (negative, via cook.ts which does its own apply — adjustPantry is the general manual/buy path).
- `setPantryQuantity(ingredientId, quantityG)` — set the absolute quantity; **rejects negative** input.
- `setRestockOverride(ingredientId, restock?)` — set or clear the per-household restock override (upserts a row if needed, e.g. you can pre-set an override before owning any stock).
- `pantry()` — return the household's rows.

- [ ] **Step 1: Write the failing test**

`convex/pantry.test.ts`:

```ts
// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

async function member(t: ReturnType<typeof convexTest>, email: string) {
  const userId = await t.run(async (ctx) => ctx.db.insert("users", { email }));
  const as = t.withIdentity({ subject: userId });
  await as.mutation(api.households.createHousehold, { name: email });
  return as;
}

test("adjustPantry adds, accumulates, and clamps at zero", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.pantry.adjustPantry, { ingredientId: "i1", deltaG: 500 });
  await a.mutation(api.pantry.adjustPantry, { ingredientId: "i1", deltaG: 200 });
  expect((await a.query(api.pantry.pantry, {}))[0].quantityG).toBe(700);
  await a.mutation(api.pantry.adjustPantry, { ingredientId: "i1", deltaG: -1000 });
  expect((await a.query(api.pantry.pantry, {}))[0].quantityG).toBe(0);
});

test("setPantryQuantity sets an absolute value and rejects negatives", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.pantry.setPantryQuantity, { ingredientId: "i1", quantityG: 250 });
  expect((await a.query(api.pantry.pantry, {}))[0].quantityG).toBe(250);
  await expect(
    a.mutation(api.pantry.setPantryQuantity, { ingredientId: "i1", quantityG: -5 }),
  ).rejects.toThrow();
});

test("setRestockOverride stores and clears the override", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.pantry.setRestockOverride, {
    ingredientId: "i1",
    restock: { quantity: 2, unit: "kg" },
  });
  expect((await a.query(api.pantry.pantry, {}))[0].restockOverride).toEqual({
    quantity: 2,
    unit: "kg",
  });
  await a.mutation(api.pantry.setRestockOverride, { ingredientId: "i1" });
  expect((await a.query(api.pantry.pantry, {}))[0].restockOverride).toBeUndefined();
});

test("pantry is household-scoped and requires membership", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  const b = await member(t, "b@example.com");
  await a.mutation(api.pantry.adjustPantry, { ingredientId: "i1", deltaG: 100 });
  expect(await b.query(api.pantry.pantry, {})).toHaveLength(0);
  await expect(
    t.mutation(api.pantry.adjustPantry, { ingredientId: "i1", deltaG: 1 }),
  ).rejects.toThrow();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- convex/pantry.test.ts`
Expected: FAIL — `api.pantry` undefined.

- [ ] **Step 3: Implement**

`convex/pantry.ts`:

```ts
import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getMembership, requireMembership } from "./lib/auth";

async function pantryRow(
  ctx: MutationCtx | QueryCtx,
  householdId: Id<"households">,
  ingredientId: string,
) {
  return await ctx.db
    .query("pantryItems")
    .withIndex("by_household_ingredient", (q) =>
      q.eq("householdId", householdId).eq("ingredientId", ingredientId),
    )
    .unique();
}

export const pantry = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const m = await getMembership(ctx, userId);
    if (!m) return [];
    const rows = await ctx.db
      .query("pantryItems")
      .withIndex("by_household", (q) => q.eq("householdId", m.householdId))
      .collect();
    return rows.map((r) => ({
      ingredientId: r.ingredientId,
      quantityG: r.quantityG,
      restockOverride: r.restockOverride ?? null,
      updatedAt: r.updatedAt,
    }));
  },
});

export const adjustPantry = mutation({
  args: { ingredientId: v.string(), deltaG: v.number() },
  handler: async (ctx, { ingredientId, deltaG }) => {
    if (!Number.isFinite(deltaG)) throw new Error("Invalid delta");
    const { householdId } = await requireMembership(ctx);
    const existing = await pantryRow(ctx, householdId, ingredientId);
    const next = Math.max(0, (existing?.quantityG ?? 0) + deltaG);
    if (existing) {
      await ctx.db.patch(existing._id, { quantityG: next, updatedAt: Date.now() });
      return;
    }
    await ctx.db.insert("pantryItems", {
      householdId,
      ingredientId,
      quantityG: next,
      updatedAt: Date.now(),
    });
  },
});

export const setPantryQuantity = mutation({
  args: { ingredientId: v.string(), quantityG: v.number() },
  handler: async (ctx, { ingredientId, quantityG }) => {
    if (!Number.isFinite(quantityG) || quantityG < 0) {
      throw new Error("Quantity must be a non-negative number");
    }
    const { householdId } = await requireMembership(ctx);
    const existing = await pantryRow(ctx, householdId, ingredientId);
    if (existing) {
      await ctx.db.patch(existing._id, { quantityG, updatedAt: Date.now() });
      return;
    }
    await ctx.db.insert("pantryItems", {
      householdId,
      ingredientId,
      quantityG,
      updatedAt: Date.now(),
    });
  },
});

export const setRestockOverride = mutation({
  args: {
    ingredientId: v.string(),
    restock: v.optional(v.object({ quantity: v.number(), unit: v.string() })),
  },
  handler: async (ctx, { ingredientId, restock }) => {
    if (restock && (!Number.isFinite(restock.quantity) || restock.quantity <= 0)) {
      throw new Error("Restock quantity must be positive");
    }
    const { householdId } = await requireMembership(ctx);
    const existing = await pantryRow(ctx, householdId, ingredientId);
    if (existing) {
      await ctx.db.patch(existing._id, {
        restockOverride: restock,
        updatedAt: Date.now(),
      });
      return;
    }
    await ctx.db.insert("pantryItems", {
      householdId,
      ingredientId,
      quantityG: 0,
      restockOverride: restock,
      updatedAt: Date.now(),
    });
  },
});
```

Note: `ctx.db.patch(id, { restockOverride: undefined })` clears the field (Convex treats an explicit `undefined` on an optional field as removal); the test asserts it becomes `undefined`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- convex/pantry.test.ts`
Expected: PASS. Then `npx convex dev --once` (clean).

- [ ] **Step 5: Commit**

```bash
git add convex/pantry.ts convex/pantry.test.ts
git commit -m "feat(2c-1): pantry mutations (adjust/set/restock-override) + pantry query"
```

---

## Task 4: `grocery.ts` — manual / skip mutations + query

**Files:**
- Create: `convex/grocery.ts`
- Test: `convex/grocery.test.ts`

Behavior (one row per (household, ingredient), `source: "manual" | "skip"`):
- `addManualItem(ingredientId, manualQuantity?)` — upsert a `manual` row.
- `removeManualItem(ingredientId)` — delete the row if it is `manual`.
- `skip(ingredientId)` — upsert a `skip` row (suppresses the computed plan need).
- `unskip(ingredientId)` — delete the row if it is `skip`.
- `clearSkips(ingredientIds)` — delete `skip` rows for the given ids (used by 2c-2 to auto-clear stale skips when a need returns to 0).
- `grocery()` — return the household's rows.

An ingredient can be either manual or skip, never both: each mutation that writes a row replaces any existing row for that ingredient with the new source.

- [ ] **Step 1: Write the failing test**

`convex/grocery.test.ts`:

```ts
// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

async function member(t: ReturnType<typeof convexTest>, email: string) {
  const userId = await t.run(async (ctx) => ctx.db.insert("users", { email }));
  const as = t.withIdentity({ subject: userId });
  await as.mutation(api.households.createHousehold, { name: email });
  return as;
}

test("addManualItem upserts one manual row per ingredient", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.grocery.addManualItem, {
    ingredientId: "i1",
    manualQuantity: { quantity: 2, unit: "lb" },
  });
  await a.mutation(api.grocery.addManualItem, {
    ingredientId: "i1",
    manualQuantity: { quantity: 3, unit: "lb" },
  });
  const rows = await a.query(api.grocery.grocery, {});
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    ingredientId: "i1",
    source: "manual",
    manualQuantity: { quantity: 3, unit: "lb" },
  });
});

test("skip then unskip; clearSkips removes by id", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.grocery.skip, { ingredientId: "i1" });
  await a.mutation(api.grocery.skip, { ingredientId: "i2" });
  expect(await a.query(api.grocery.grocery, {})).toHaveLength(2);
  await a.mutation(api.grocery.unskip, { ingredientId: "i1" });
  expect((await a.query(api.grocery.grocery, {})).map((r) => r.ingredientId)).toEqual(["i2"]);
  await a.mutation(api.grocery.clearSkips, { ingredientIds: ["i2", "nope"] });
  expect(await a.query(api.grocery.grocery, {})).toHaveLength(0);
});

test("skip replaces an existing manual row for the same ingredient (never both)", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.grocery.addManualItem, { ingredientId: "i1" });
  await a.mutation(api.grocery.skip, { ingredientId: "i1" });
  const rows = await a.query(api.grocery.grocery, {});
  expect(rows).toHaveLength(1);
  expect(rows[0].source).toBe("skip");
});

test("removeManualItem does not delete a skip row", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.grocery.skip, { ingredientId: "i1" });
  await a.mutation(api.grocery.removeManualItem, { ingredientId: "i1" });
  expect(await a.query(api.grocery.grocery, {})).toHaveLength(1);
});

test("grocery is household-scoped and requires membership", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  const b = await member(t, "b@example.com");
  await a.mutation(api.grocery.addManualItem, { ingredientId: "i1" });
  expect(await b.query(api.grocery.grocery, {})).toHaveLength(0);
  await expect(
    t.mutation(api.grocery.skip, { ingredientId: "i1" }),
  ).rejects.toThrow();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- convex/grocery.test.ts`
Expected: FAIL — `api.grocery` undefined.

- [ ] **Step 3: Implement**

`convex/grocery.ts`:

```ts
import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getMembership, requireMembership } from "./lib/auth";

async function groceryRow(
  ctx: MutationCtx | QueryCtx,
  householdId: Id<"households">,
  ingredientId: string,
) {
  return await ctx.db
    .query("groceryItems")
    .withIndex("by_household_ingredient", (q) =>
      q.eq("householdId", householdId).eq("ingredientId", ingredientId),
    )
    .unique();
}

export const grocery = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const m = await getMembership(ctx, userId);
    if (!m) return [];
    const rows = await ctx.db
      .query("groceryItems")
      .withIndex("by_household", (q) => q.eq("householdId", m.householdId))
      .collect();
    return rows.map((r) => ({
      ingredientId: r.ingredientId,
      source: r.source,
      manualQuantity: r.manualQuantity ?? null,
    }));
  },
});

async function writeRow(
  ctx: MutationCtx,
  ingredientId: string,
  source: "manual" | "skip",
  manualQuantity?: { quantity: number; unit: string },
) {
  const { householdId, userId } = await requireMembership(ctx);
  const existing = await groceryRow(ctx, householdId, ingredientId);
  if (existing) {
    await ctx.db.patch(existing._id, { source, manualQuantity });
    return;
  }
  await ctx.db.insert("groceryItems", {
    householdId,
    ingredientId,
    source,
    manualQuantity,
    addedByUserId: userId,
    createdAt: Date.now(),
  });
}

export const addManualItem = mutation({
  args: {
    ingredientId: v.string(),
    manualQuantity: v.optional(v.object({ quantity: v.number(), unit: v.string() })),
  },
  handler: (ctx, { ingredientId, manualQuantity }) =>
    writeRow(ctx, ingredientId, "manual", manualQuantity),
});

export const skip = mutation({
  args: { ingredientId: v.string() },
  handler: (ctx, { ingredientId }) => writeRow(ctx, ingredientId, "skip"),
});

async function deleteRowOfSource(
  ctx: MutationCtx,
  ingredientId: string,
  source: "manual" | "skip",
) {
  const { householdId } = await requireMembership(ctx);
  const existing = await groceryRow(ctx, householdId, ingredientId);
  if (existing && existing.source === source) await ctx.db.delete(existing._id);
}

export const removeManualItem = mutation({
  args: { ingredientId: v.string() },
  handler: (ctx, { ingredientId }) => deleteRowOfSource(ctx, ingredientId, "manual"),
});

export const unskip = mutation({
  args: { ingredientId: v.string() },
  handler: (ctx, { ingredientId }) => deleteRowOfSource(ctx, ingredientId, "skip"),
});

export const clearSkips = mutation({
  args: { ingredientIds: v.array(v.string()) },
  handler: async (ctx, { ingredientIds }) => {
    const { householdId } = await requireMembership(ctx);
    for (const ingredientId of ingredientIds) {
      const existing = await groceryRow(ctx, householdId, ingredientId);
      if (existing && existing.source === "skip") await ctx.db.delete(existing._id);
    }
  },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- convex/grocery.test.ts`
Expected: PASS. Then `npx convex dev --once` (clean).

- [ ] **Step 5: Commit**

```bash
git add convex/grocery.ts convex/grocery.test.ts
git commit -m "feat(2c-1): grocery mutations (manual/skip/clearSkips) + grocery query"
```

---

## Task 5: `cook.ts` — the transactional cook mutation

**Files:**
- Create: `convex/cook.ts`
- Test: `convex/cook.test.ts`

`cook({ recipeId, deltas, at })` runs one transaction:
1. For each `{ ingredientId, subtract }` in `deltas`: set `pantryItems.quantityG = max(0, current − subtract)` (upsert; missing row → clamps to 0).
2. Increment the household's `recipeState.madeCount` and set `lastMadeAt = at` (upsert, mirroring `recipeState.markMade`).
3. Delete the `planRecipes` row for `recipeId` (if planned).

`deltas` are computed by the 2c-2 server layer from the recipe's required + used-optional amounts (Spec 2b). `at` must be a positive finite timestamp. Skip cleanup is handled separately by the server (`grocery.clearSkips`) after recomputing needs.

- [ ] **Step 1: Write the failing test**

`convex/cook.test.ts`:

```ts
// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

async function member(t: ReturnType<typeof convexTest>, email: string) {
  const userId = await t.run(async (ctx) => ctx.db.insert("users", { email }));
  const as = t.withIdentity({ subject: userId });
  await as.mutation(api.households.createHousehold, { name: email });
  return as;
}

test("cook depletes pantry (clamped), records made-it, and unplans the recipe", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.pantry.adjustPantry, { ingredientId: "beef", deltaG: 500 });
  await a.mutation(api.pantry.adjustPantry, { ingredientId: "egg", deltaG: 100 });
  await a.mutation(api.plan.addToPlan, { recipeId: "r1", scale: 1 });

  await a.mutation(api.cook.cook, {
    recipeId: "r1",
    at: 1000,
    deltas: [
      { ingredientId: "beef", subtract: 200 },
      { ingredientId: "egg", subtract: 1000 }, // more than on hand -> clamp 0
    ],
  });

  const pantry = await a.query(api.pantry.pantry, {});
  const byId = Object.fromEntries(pantry.map((r) => [r.ingredientId, r.quantityG]));
  expect(byId.beef).toBe(300);
  expect(byId.egg).toBe(0);

  const state = await a.query(api.recipeState.forRecipe, { recipeId: "r1" });
  expect(state).toMatchObject({ madeCount: 1, lastMadeAt: 1000 });

  expect(await a.query(api.plan.plan, {})).toHaveLength(0);
});

test("cook on an unplanned recipe still depletes + records made-it", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.pantry.adjustPantry, { ingredientId: "beef", deltaG: 500 });
  await a.mutation(api.cook.cook, {
    recipeId: "r1",
    at: 1000,
    deltas: [{ ingredientId: "beef", subtract: 100 }],
  });
  expect((await a.query(api.recipeState.forRecipe, { recipeId: "r1" })).madeCount).toBe(1);
  const pantry = await a.query(api.pantry.pantry, {});
  expect(pantry.find((r) => r.ingredientId === "beef")?.quantityG).toBe(400);
});

test("cook rejects a bad timestamp and requires membership", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await expect(
    a.mutation(api.cook.cook, { recipeId: "r1", at: 0, deltas: [] }),
  ).rejects.toThrow(/timestamp/i);
  await expect(
    t.mutation(api.cook.cook, { recipeId: "r1", at: 1000, deltas: [] }),
  ).rejects.toThrow();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- convex/cook.test.ts`
Expected: FAIL — `api.cook` undefined.

- [ ] **Step 3: Implement**

`convex/cook.ts`:

```ts
import { v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireMembership } from "./lib/auth";

async function depleteOne(
  ctx: MutationCtx,
  householdId: Id<"households">,
  ingredientId: string,
  subtract: number,
) {
  const existing = await ctx.db
    .query("pantryItems")
    .withIndex("by_household_ingredient", (q) =>
      q.eq("householdId", householdId).eq("ingredientId", ingredientId),
    )
    .unique();
  const next = Math.max(0, (existing?.quantityG ?? 0) - subtract);
  if (existing) {
    await ctx.db.patch(existing._id, { quantityG: next, updatedAt: Date.now() });
  } else {
    await ctx.db.insert("pantryItems", {
      householdId,
      ingredientId,
      quantityG: next,
      updatedAt: Date.now(),
    });
  }
}

async function recordMade(
  ctx: MutationCtx,
  householdId: Id<"households">,
  recipeId: string,
  at: number,
) {
  const existing = await ctx.db
    .query("recipeState")
    .withIndex("by_household_recipe", (q) =>
      q.eq("householdId", householdId).eq("recipeId", recipeId),
    )
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, {
      madeCount: existing.madeCount + 1,
      lastMadeAt: at,
    });
  } else {
    await ctx.db.insert("recipeState", {
      householdId,
      recipeId,
      madeCount: 1,
      lastMadeAt: at,
      toTry: false,
    });
  }
}

export const cook = mutation({
  args: {
    recipeId: v.string(),
    at: v.number(),
    deltas: v.array(v.object({ ingredientId: v.string(), subtract: v.number() })),
  },
  handler: async (ctx, { recipeId, at, deltas }) => {
    if (!Number.isFinite(at) || at <= 0) throw new Error("Invalid timestamp");
    const { householdId } = await requireMembership(ctx);

    for (const d of deltas) {
      if (!Number.isFinite(d.subtract) || d.subtract < 0) continue;
      await depleteOne(ctx, householdId, d.ingredientId, d.subtract);
    }

    await recordMade(ctx, householdId, recipeId, at);

    const planned = await ctx.db
      .query("planRecipes")
      .withIndex("by_household_recipe", (q) =>
        q.eq("householdId", householdId).eq("recipeId", recipeId),
      )
      .unique();
    if (planned) await ctx.db.delete(planned._id);
  },
});
```

**NOTE for the implementer:** `recordMade` duplicates `recipeState.markMade`'s upsert. That duplication is acceptable here (cook is one transaction and importing across function modules in Convex is awkward), but if `recipeState.ts` already exports a reusable `incrementMade(ctx, householdId, recipeId, at)` helper, use it instead. Check `convex/recipeState.ts` first; only inline `recordMade` if no such helper exists. Do not refactor `recipeState.ts` beyond optionally extracting that helper.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- convex/cook.test.ts`
Expected: PASS. Then run the whole convex suite + deploy check:
Run: `npm test -- convex/` then `npx convex dev --once`
Expected: all PASS, schema deploys clean.

- [ ] **Step 5: Commit**

```bash
git add convex/cook.ts convex/cook.test.ts
git commit -m "feat(2c-1): transactional cook mutation (deplete + made-it + unplan)"
```

---

## Task 6: Full gate + `/code-review`

**Files:** none (verification).

- [ ] **Step 1: Run the full gate**

Run: `npm test` then `npm run lint` then `npx tsc --noEmit` then `npx convex dev --once`. Report results — all green expected.

- [ ] **Step 2: `/code-review` the 2c-1 commits and address findings**

Then proceed to the **Spec 2c-2** plan (server orchestration: assemble `metaFor`/pantry-map from Sanity + Convex, wire the buy/cook/need/cookable flows via the Spec 2b lib, and rewire the home cookable filter).

---

## Self-Review (completed by plan author)

- **Spec coverage (§7):** the three tables with unique-by-pair indexes (Task 1); plan add/remove/setScale (Task 2); pantry adjust/set/restock-override (Task 3); manual/skip/clearSkips grocery (Task 4); transactional cook = deplete (clamp ≥0) + madeCount/lastMadeAt + unplan (Task 5). `requireMembership` on every mutation + household-scoped queries (all tasks). Plan-derived needs NOT stored (only manual/skip rows) ✓. Skip cleanup hook (`clearSkips`) provided for 2c-2's need→0 reconciliation ✓.
- **Deferred to 2c-2 (correctly not here):** Sanity joins, `metaFor` assembly, computing `deltas`/needs/cookable via the 2b lib, the buy→restock-grams conversion, the cookable rewire of `src/lib/pantry.ts`, surfacing `unparsed` lines.
- **Placeholders:** none — every step has full code. The `plan` query deliberately shows an awkward block plus the clean replacement to use; the implementer is instructed to use the clean version (matches `recipeState.mine`).
- **Type consistency:** tables in `schema.ts` (Task 1) are referenced by every mutation/query; `by_household_ingredient` / `by_household_recipe` index names are used consistently; `cook`'s `deltas` shape (`{ingredientId, subtract}`) is the contract 2c-2 produces from `depletionDeltas`. `manualQuantity`/`restockOverride` object shape `{quantity, unit}` matches the schema and Spec 2b's `RestockQuantity`.
- **Convex specifics:** `Date.now()` is allowed in mutations (server runtime); convex-test files carry the `edge-runtime` + `vite/client` header; `*.test.ts` already excluded from `convex/tsconfig.json`.
