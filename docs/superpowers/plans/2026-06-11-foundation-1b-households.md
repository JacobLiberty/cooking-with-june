# Foundation 1b — Households + Invites + Auth-Model Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce households (create + invite-code join + onboarding gate), swap the auth model from the Sanity editor allowlist to "authenticated household member," and move recipe **ratings** into Convex (they're entangled with the editor doc we're retiring). Any signed-in member can edit/publish/rate.

**Architecture:** New Convex tables `households` / `memberships` / `invites` / `ratings`, with member-gated mutations/queries. `getViewer()`/`requireEditor()` are re-expressed in terms of Convex membership (no more Sanity editor lookup — removes the extra hop and fixes the header dead-link). Ratings move off the Sanity recipe doc into Convex (global, keyed by `recipeId`+`userId`); the recipe page reads aggregate + my-rating from Convex. The Sanity `editor` doc type, `rating` object, allowlist lib, and `rating-mutate` are retired. **Made-it, to-try, and notes stay in Sanity (global) for now — they move to per-household Convex in Plan 1c.**

**Tech Stack:** Convex (+ `convex-test` for backend TDD), `@convex-dev/auth`, Next.js 16 App Router, Vitest.

**Scope note:** Plan 2 of 3 for Spec 1 (Foundation). Builds on 1a (Convex Auth). 1c handles made-it/to-try/notes → per-household Convex + filters + the bulk data migration.

---

## Decisions carried in

- One household per user (v1). Owner (creator) can generate/revoke invites + remove members; all members have equal edit/publish/rate rights.
- Invite via shareable **code** (no email). Optional expiry.
- "Editor" = authenticated household member. The Sanity editor allowlist is retired.
- Migration: you sign in → create the "Jacob & Lily" household → invite Lily → she joins. The onboarding flow *is* the household migration. Existing Sanity ratings (yours + Lily's) are remapped to Convex user ids by a one-time mutation.

---

## File structure

| File | Responsibility |
|---|---|
| `convex/schema.ts` (modify) | Add `households`, `memberships`, `invites`, `ratings` tables + indexes |
| `convex/lib/auth.ts` (create) | `requireUserId(ctx)`, `getMembership(ctx)`, `requireMembership(ctx)` helpers |
| `convex/households.ts` (create) | `viewer` query; `createHousehold`, `createInvite`, `acceptInvite`, `leaveHousehold` mutations |
| `convex/households.test.ts` (create) | convex-test coverage for the above |
| `convex/ratings.ts` (create) | `forRecipe` query (avg/count/mine); `rate` mutation |
| `convex/ratings.test.ts` (create) | convex-test coverage |
| `convex/migrations.ts` (create) | `seedRatingsFromSanity` one-time internal mutation (editor _id → userId) |
| `src/lib/viewer.ts` (modify) | `getViewer`/`requireMember` on Convex membership; new `Viewer` shape |
| `src/lib/viewer-map.ts` (modify) | Drop editor bridge; pure mapper for membership → viewer |
| `src/lib/viewer-map.test.ts` (modify) | Update for new mapper |
| `src/app/household/setup/page.tsx` (create) | Onboarding: create household OR enter invite code |
| `src/components/household-setup.tsx` (create) | Client form for setup page |
| `src/components/invite-panel.tsx` (create) | Owner UI to generate/copy an invite code (shown on /plan or a settings area) |
| `src/components/auth-controls.tsx` (modify) | Use a membership-aware query so Plan/Setup links show correctly |
| `src/app/(site)/plan/page.tsx`, `recipe/new`, `recipe/[slug]/edit`, `studio` (modify) | Redirect: not-authed → `/`; authed-no-household → `/household/setup` |
| `src/app/(site)/recipe/[slug]/page.tsx` (modify) | Read ratings from Convex (aggregate + mine); drop Sanity `editorId` rating logic |
| `src/app/actions/recipe-actions.ts` (modify) | `rateRecipe` removed (replaced by Convex mutation); other actions `requireEditor`→`requireMember` |
| `src/components/star-rating.tsx` + recipe rating UI (modify) | Call the Convex `rate` mutation |
| Retire: `src/sanity/schemaTypes/documents/editor.ts`, `objects/rating.ts`, `src/sanity/lib/editors.ts`, `src/lib/editor-allowlist.ts`, `src/lib/rating-mutate.ts` + remove `ratings`/`editor` from `queries.ts` + `schemaTypes/index.ts` | Drop the Sanity editor/rating system |

---

## Phase A — Convex household backend

### Task A1: Install convex-test and configure the edge-runtime environment

**Files:** `package.json`, `convex/test.setup.ts` (optional)

- [ ] **Step 1: Install**

```bash
npm install -D convex-test @edge-runtime/vm
```

- [ ] **Step 2: Note the per-file environment**

Convex tests must run under the edge-runtime environment. Each convex test file starts with:
```typescript
// @vitest-environment edge-runtime
```
(The repo's global vitest env stays `jsdom` for component tests.)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add convex-test + edge-runtime for convex backend tests"
```

### Task A2: Schema — households, memberships, invites, ratings

**Files:** `convex/schema.ts`

- [ ] **Step 1: Extend the schema**

Replace `convex/schema.ts` with:
```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  households: defineTable({
    name: v.string(),
    ownerUserId: v.id("users"),
  }).index("by_owner", ["ownerUserId"]),

  memberships: defineTable({
    userId: v.id("users"),
    householdId: v.id("households"),
    role: v.union(v.literal("owner"), v.literal("member")),
  })
    .index("by_user", ["userId"])
    .index("by_household", ["householdId"]),

  invites: defineTable({
    householdId: v.id("households"),
    code: v.string(),
    createdByUserId: v.id("users"),
    expiresAt: v.optional(v.number()),
    usedByUserId: v.optional(v.id("users")),
  }).index("by_code", ["code"]),

  // Global per-user recipe ratings (recipeId is a Sanity _id string).
  ratings: defineTable({
    recipeId: v.string(),
    userId: v.id("users"),
    value: v.number(),
  })
    .index("by_recipe", ["recipeId"])
    .index("by_recipe_user", ["recipeId", "userId"]),
});
```

- [ ] **Step 2: Push + validate**

```bash
npx convex dev --once
```
Expected: new table indexes added, no errors.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts convex/_generated
git commit -m "feat: convex schema for households, memberships, invites, ratings"
```

### Task A3: Auth helpers

**Files:** `convex/lib/auth.ts`

- [ ] **Step 1: Write the helpers**

```typescript
import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export async function requireUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  return userId;
}

export async function getMembership(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
) {
  return await ctx.db
    .query("memberships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

export async function requireMembership(ctx: QueryCtx | MutationCtx) {
  const userId = await requireUserId(ctx);
  const membership = await getMembership(ctx, userId);
  if (!membership) throw new Error("No household: complete setup first");
  return { userId, householdId: membership.householdId, role: membership.role };
}
```

- [ ] **Step 2: Typecheck via push**

```bash
npx convex dev --once && echo OK
```

- [ ] **Step 3: Commit**

```bash
git add convex/lib/auth.ts convex/_generated
git commit -m "feat: convex auth helpers (requireUserId, membership)"
```

### Task A4: Household functions (TDD)

**Files:** `convex/households.ts`, `convex/households.test.ts`

- [ ] **Step 1: Write failing tests**

`convex/households.test.ts`:
```typescript
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

async function newUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run(async (ctx) => ctx.db.insert("users", { email }));
}

test("createHousehold makes the creator an owner", async () => {
  const t = convexTest(schema);
  const userId = await newUser(t, "jacob@example.com");
  const as = t.withIdentity({ subject: userId });

  const householdId = await as.mutation(api.households.createHousehold, {
    name: "Jacob & Lily",
  });

  const viewer = await as.query(api.households.viewer, {});
  expect(viewer).toMatchObject({ householdId, role: "owner", name: null });
});

test("createHousehold rejects a second household for the same user", async () => {
  const t = convexTest(schema);
  const userId = await newUser(t, "jacob@example.com");
  const as = t.withIdentity({ subject: userId });
  await as.mutation(api.households.createHousehold, { name: "One" });
  await expect(
    as.mutation(api.households.createHousehold, { name: "Two" }),
  ).rejects.toThrow(/already/i);
});

test("invite code lets a second user join", async () => {
  const t = convexTest(schema);
  const owner = await newUser(t, "jacob@example.com");
  const ownerAs = t.withIdentity({ subject: owner });
  await ownerAs.mutation(api.households.createHousehold, { name: "Home" });
  const code = await ownerAs.mutation(api.households.createInvite, {});

  const joiner = await newUser(t, "lily@example.com");
  const joinerAs = t.withIdentity({ subject: joiner });
  await joinerAs.mutation(api.households.acceptInvite, { code });

  const v = await joinerAs.query(api.households.viewer, {});
  expect(v).toMatchObject({ role: "member" });
});

test("acceptInvite rejects an unknown or used code", async () => {
  const t = convexTest(schema);
  const owner = await newUser(t, "jacob@example.com");
  const ownerAs = t.withIdentity({ subject: owner });
  await ownerAs.mutation(api.households.createHousehold, { name: "Home" });
  const code = await ownerAs.mutation(api.households.createInvite, {});

  const a = await newUser(t, "a@example.com");
  await t.withIdentity({ subject: a }).mutation(api.households.acceptInvite, { code });

  const b = await newUser(t, "b@example.com");
  await expect(
    t.withIdentity({ subject: b }).mutation(api.households.acceptInvite, { code }),
  ).rejects.toThrow(/invalid|used/i);
  await expect(
    t.withIdentity({ subject: b }).mutation(api.households.acceptInvite, { code: "nope" }),
  ).rejects.toThrow(/invalid/i);
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run convex/households.test.ts
```
Expected: FAIL — `api.households.*` undefined.

- [ ] **Step 3: Implement**

`convex/households.ts`:
```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getMembership, requireUserId, requireMembership } from "./lib/auth";

// Current user's identity + household context, or null when unauthenticated.
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    const membership = await getMembership(ctx, userId);
    return {
      userId,
      name: user?.name ?? null,
      householdId: membership?.householdId ?? null,
      role: membership?.role ?? null,
    };
  },
});

export const createHousehold = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await requireUserId(ctx);
    const existing = await getMembership(ctx, userId);
    if (existing) throw new Error("You already belong to a household");
    const clean = name.trim();
    if (!clean) throw new Error("Household name is required");
    const householdId = await ctx.db.insert("households", {
      name: clean,
      ownerUserId: userId,
    });
    await ctx.db.insert("memberships", { userId, householdId, role: "owner" });
    return householdId;
  },
});

function makeCode(): string {
  // 8 chars, unambiguous alphabet. Math.random is allowed in Convex mutations.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export const createInvite = mutation({
  args: {},
  handler: async (ctx) => {
    const { householdId, role } = await requireMembership(ctx);
    if (role !== "owner") throw new Error("Only the owner can invite");
    const userId = await requireUserId(ctx);
    const code = makeCode();
    await ctx.db.insert("invites", {
      householdId,
      code,
      createdByUserId: userId,
    });
    return code;
  },
});

export const acceptInvite = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await requireUserId(ctx);
    if (await getMembership(ctx, userId)) {
      throw new Error("You already belong to a household");
    }
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_code", (q) => q.eq("code", code.trim().toUpperCase()))
      .unique();
    if (!invite) throw new Error("Invalid invite code");
    if (invite.usedByUserId) throw new Error("Invite code already used");
    if (invite.expiresAt && invite.expiresAt < Date.now()) {
      throw new Error("Invite code expired");
    }
    await ctx.db.insert("memberships", {
      userId,
      householdId: invite.householdId,
      role: "member",
    });
    await ctx.db.patch(invite._id, { usedByUserId: userId });
    return invite.householdId;
  },
});

export const leaveHousehold = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId, role } = await requireMembership(ctx);
    if (role === "owner") {
      throw new Error("The owner cannot leave; transfer or delete the household");
    }
    const membership = await getMembership(ctx, userId);
    if (membership) await ctx.db.delete(membership._id);
  },
});
```

> Note: `createInvite` stores the code as-is from `makeCode()` (uppercase alphabet); `acceptInvite` uppercases input before lookup, so codes are case-insensitive for the joiner.

- [ ] **Step 4: Run to verify pass**

```bash
npx vitest run convex/households.test.ts
```
Expected: PASS (4 tests). Then `npx convex dev --once` to push.

- [ ] **Step 5: Commit**

```bash
git add convex/households.ts convex/households.test.ts convex/_generated
git commit -m "feat: household create/invite/accept/leave + viewer (TDD)"
```

---

## Phase B — Convex ratings backend

### Task B1: Ratings functions (TDD)

**Files:** `convex/ratings.ts`, `convex/ratings.test.ts`

- [ ] **Step 1: Write failing tests**

`convex/ratings.test.ts`:
```typescript
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

async function member(t: ReturnType<typeof convexTest>, email: string) {
  const userId = await t.run(async (ctx) => ctx.db.insert("users", { email }));
  const as = t.withIdentity({ subject: userId });
  await as.mutation(api.households.createHousehold, { name: email });
  return as;
}

test("rate upserts the caller's rating and aggregates", async () => {
  const t = convexTest(schema);
  const a = await member(t, "a@example.com");
  const b = await member(t, "b@example.com");

  await a.mutation(api.ratings.rate, { recipeId: "recipe-1", value: 4 });
  await b.mutation(api.ratings.rate, { recipeId: "recipe-1", value: 2 });
  await a.mutation(api.ratings.rate, { recipeId: "recipe-1", value: 5 }); // overwrite

  const agg = await a.query(api.ratings.forRecipe, { recipeId: "recipe-1" });
  expect(agg).toEqual({ average: 3.5, count: 2, mine: 5 });
});

test("forRecipe returns zeros and null mine when unrated", async () => {
  const t = convexTest(schema);
  const a = await member(t, "a@example.com");
  const agg = await a.query(api.ratings.forRecipe, { recipeId: "none" });
  expect(agg).toEqual({ average: 0, count: 0, mine: null });
});

test("rate rejects out-of-range values", async () => {
  const t = convexTest(schema);
  const a = await member(t, "a@example.com");
  await expect(
    a.mutation(api.ratings.rate, { recipeId: "r", value: 9 }),
  ).rejects.toThrow(/0.*5/);
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run convex/ratings.test.ts
```
Expected: FAIL — `api.ratings.*` undefined.

- [ ] **Step 3: Implement**

`convex/ratings.ts`:
```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireMembership } from "./lib/auth";

export const forRecipe = query({
  args: { recipeId: v.string() },
  handler: async (ctx, { recipeId }) => {
    const rows = await ctx.db
      .query("ratings")
      .withIndex("by_recipe", (q) => q.eq("recipeId", recipeId))
      .collect();
    const count = rows.length;
    const average =
      count === 0 ? 0 : rows.reduce((s, r) => s + r.value, 0) / count;

    const userId = await getAuthUserId(ctx);
    const mine = userId
      ? (rows.find((r) => r.userId === userId)?.value ?? null)
      : null;

    return { average, count, mine };
  },
});

export const rate = mutation({
  args: { recipeId: v.string(), value: v.number() },
  handler: async (ctx, { recipeId, value }) => {
    const { userId } = await requireMembership(ctx);
    if (typeof value !== "number" || value < 0 || value > 5) {
      throw new Error("Rating must be 0–5");
    }
    const existing = await ctx.db
      .query("ratings")
      .withIndex("by_recipe_user", (q) =>
        q.eq("recipeId", recipeId).eq("userId", userId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { value });
    } else {
      await ctx.db.insert("ratings", { recipeId, userId, value });
    }
  },
});
```

- [ ] **Step 4: Run to verify pass + push**

```bash
npx vitest run convex/ratings.test.ts && npx convex dev --once
```
Expected: PASS (3 tests), push clean.

- [ ] **Step 5: Commit**

```bash
git add convex/ratings.ts convex/ratings.test.ts convex/_generated
git commit -m "feat: convex ratings (rate + forRecipe aggregate, TDD)"
```

### Task B2: Batch aggregate for recipe grids

The home/collection grid shows an average + "June approved" badge per card ([recipe-card.tsx:12-17](../../../src/components/recipe-card.tsx#L12-L17) via `averageRating`/`isJuneApproved`), currently from the Sanity ratings projection we're removing. Add a single batched Convex query so the grid makes one call, not one-per-card.

**Files:** `convex/ratings.ts`, `convex/ratings.test.ts`

- [ ] **Step 1: Add a failing test** for `forRecipes` returning a `{ [recipeId]: { average, count } }` map for a list of ids (recipes with no ratings omitted or zeroed). Run it (expect FAIL).

- [ ] **Step 2: Implement `forRecipes`** in `convex/ratings.ts`:
```typescript
export const forRecipes = query({
  args: { recipeIds: v.array(v.string()) },
  handler: async (ctx, { recipeIds }) => {
    const out: Record<string, { average: number; count: number }> = {};
    for (const recipeId of recipeIds) {
      const rows = await ctx.db
        .query("ratings")
        .withIndex("by_recipe", (q) => q.eq("recipeId", recipeId))
        .collect();
      const count = rows.length;
      out[recipeId] = {
        count,
        average: count === 0 ? 0 : rows.reduce((s, r) => s + r.value, 0) / count,
      };
    }
    return out;
  },
});
```

- [ ] **Step 3: Run test (PASS) + push + commit**

```bash
npx vitest run convex/ratings.test.ts && npx convex dev --once
git add convex/ratings.ts convex/ratings.test.ts convex/_generated
git commit -m "feat: batched ratings.forRecipes for grids"
```

---

## Phase C — Server viewer on membership

### Task C1: Rewrite the viewer mapper (TDD)

**Files:** `src/lib/viewer-map.ts`, `src/lib/viewer-map.test.ts`

- [ ] **Step 1: Update the test**

Replace `src/lib/viewer-map.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { mapViewer } from "./viewer-map";

describe("mapViewer", () => {
  it("maps a member with a household", () => {
    expect(
      mapViewer({ userId: "u1", name: "Jacob", householdId: "h1", role: "owner" }),
    ).toEqual({
      isAuthenticated: true,
      isMember: true,
      userId: "u1",
      householdId: "h1",
      role: "owner",
      name: "Jacob",
    });
  });

  it("maps an authenticated user without a household", () => {
    expect(
      mapViewer({ userId: "u1", name: null, householdId: null, role: null }),
    ).toEqual({
      isAuthenticated: true,
      isMember: false,
      userId: "u1",
      householdId: null,
      role: null,
      name: null,
    });
  });

  it("maps an anonymous viewer from null", () => {
    expect(mapViewer(null)).toEqual({
      isAuthenticated: false,
      isMember: false,
      userId: null,
      householdId: null,
      role: null,
      name: null,
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run src/lib/viewer-map.test.ts
```
Expected: FAIL — `mapViewer` not exported.

- [ ] **Step 3: Implement**

Replace `src/lib/viewer-map.ts`:
```typescript
export type ViewerRecord = {
  userId: string;
  name: string | null;
  householdId: string | null;
  role: "owner" | "member" | null;
};

export type Viewer = {
  isAuthenticated: boolean;
  isMember: boolean;
  userId: string | null;
  householdId: string | null;
  role: "owner" | "member" | null;
  name: string | null;
};

export const ANON_VIEWER: Viewer = {
  isAuthenticated: false,
  isMember: false,
  userId: null,
  householdId: null,
  role: null,
  name: null,
};

export function mapViewer(record: ViewerRecord | null): Viewer {
  if (!record) return ANON_VIEWER;
  return {
    isAuthenticated: true,
    isMember: record.householdId != null,
    userId: record.userId,
    householdId: record.householdId,
    role: record.role,
    name: record.name,
  };
}
```

- [ ] **Step 4: Run to verify pass**

```bash
npx vitest run src/lib/viewer-map.test.ts
```
Expected: PASS (3 tests).

### Task C2: Rewrite `viewer.ts`

**Files:** `src/lib/viewer.ts`

- [ ] **Step 1: Implement**

Replace `src/lib/viewer.ts`:
```typescript
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@cvx/_generated/api";
import { mapViewer, ANON_VIEWER, type Viewer } from "@/lib/viewer-map";

export type { Viewer };

// Server-only: resolve the current viewer from the Convex membership record.
export async function getViewer(): Promise<Viewer> {
  const token = await convexAuthNextjsToken();
  if (!token) return ANON_VIEWER;
  const record = await fetchQuery(api.households.viewer, {}, { token });
  return mapViewer(record);
}

// Throws unless the request is an authenticated household member.
export async function requireMember(): Promise<{
  userId: string;
  householdId: string;
}> {
  const viewer = await getViewer();
  if (!viewer.isMember || !viewer.userId || !viewer.householdId) {
    throw new Error("Not authorized: household members only");
  }
  return { userId: viewer.userId, householdId: viewer.householdId };
}
```

- [ ] **Step 2: Commit Phase C (after consumers compile in C3)**

(Compilation will fail until C3 updates consumers — commit together.)

### Task C3: Update all viewer consumers

**Files:** `src/app/(site)/plan/page.tsx`, `src/app/(site)/recipe/new/page.tsx`, `src/app/(site)/recipe/[slug]/edit/page.tsx`, `src/app/studio/[[...tool]]/page.tsx`, `src/app/(site)/page.tsx`, `src/app/(site)/recipe/[slug]/page.tsx`, `src/app/actions/plan-actions.ts`, `src/app/actions/recipe-actions.ts`

- [ ] **Step 1: Member-gated pages — redirect by auth state**

For each of `plan/page.tsx`, `recipe/new/page.tsx`, `recipe/[slug]/edit/page.tsx`, `studio/[[...tool]]/page.tsx`, replace the `if (!viewer.isEditor) redirect("/")` line with:
```tsx
if (!viewer.isAuthenticated) redirect("/");
if (!viewer.isMember) redirect("/household/setup");
```

- [ ] **Step 2: Home + recipe pages — rename `isEditor` → `isMember`**

In `src/app/(site)/page.tsx` and `src/app/(site)/recipe/[slug]/page.tsx`, replace every `viewer.isEditor` with `viewer.isMember`. (These gate optional UI like the pantry fetch and editor buttons.)

- [ ] **Step 3: plan-actions — `requireEditor` → `requireMember`**

In `src/app/actions/plan-actions.ts`, change the import and all `await requireEditor()` calls to `await requireMember()`:
```tsx
import { requireMember } from "@/lib/viewer";
// ...replace each: await requireEditor();  ->  await requireMember();
```

- [ ] **Step 4: recipe-actions — `requireEditor` → `requireMember`, drop rating**

In `src/app/actions/recipe-actions.ts`: change the import to `requireMember`; replace every `await requireEditor()` with `await requireMember()`; for `addNote`, replace `const { name } = await requireEditor();` — note `requireMember` returns `{ userId, householdId }`, not `name`. Fetch the name from the viewer instead:
```tsx
import { getViewer, requireMember } from "@/lib/viewer";
// in addNote:
const viewer = await getViewer();
if (!viewer.isMember) return { ok: false, error: "Not authorized" };
const author = viewer.name ?? undefined;
// ...use `author` where `name` was used
```
Delete the entire `rateRecipe` function and its `upsertRating`/`StoredRating` import (ratings now live in Convex — Phase D wires the UI).

- [ ] **Step 5: Typecheck**

```bash
npx convex dev --once && npx tsc --noEmit
```
Expected: PASS (recipe page still references Convex ratings in Phase D; if it errors on `viewer.editorId`, that's fixed in D1).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: swap auth model to household membership (getViewer/requireMember)"
```

---

## Phase D — Wire ratings UI to Convex + retire Sanity ratings

### Task D1: Recipe page reads ratings from Convex

**Files:** `src/app/(site)/recipe/[slug]/page.tsx`, `src/sanity/lib/queries.ts`

- [ ] **Step 1: Drop Sanity rating projections**

In `src/sanity/lib/queries.ts`, remove the two `"ratings": ratings[]{ ... }` lines (lines ~16 and ~37) from the recipe queries.

- [ ] **Step 2: Fetch Convex ratings in the recipe page**

In `src/app/(site)/recipe/[slug]/page.tsx`, remove the `viewer.editorId`-based `myRating` block (lines ~82-83). Add a Convex fetch alongside the existing data load:
```tsx
import { fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@cvx/_generated/api";
// ...
const token = await convexAuthNextjsToken();
const ratingAgg = await fetchQuery(
  api.ratings.forRecipe,
  { recipeId: recipe._id },
  token ? { token } : {},
);
// ratingAgg = { average, count, mine }
```
Pass `ratingAgg.average` / `ratingAgg.count` to the display and `ratingAgg.mine` to the interactive control.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```
Expected: PASS.

### Task D2: Rating control calls the Convex mutation

**Files:** `src/components/star-rating.tsx` (+ wherever the editable rating is rendered)

- [ ] **Step 1: Use the Convex mutation in the interactive control**

In the editable star-rating client component, replace the server-action call with:
```tsx
"use client";
import { useMutation } from "convex/react";
import { api } from "@cvx/_generated/api";
// ...
const rate = useMutation(api.ratings.rate);
// onSelect(value): await rate({ recipeId, value });
```
(Pass `recipeId` and the initial `mine` value as props from the recipe page.)

- [ ] **Step 2: Update the component's test** to mock `convex/react`'s `useMutation` (mirror the AuthControls test pattern). Run:
```bash
npx vitest run src/components/star-rating.test.tsx
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: ratings read/write via convex on the recipe page"
```

### Task D2b: Grid/card ratings from the batch aggregate

**Files:** `src/components/recipe-card.tsx`, `src/lib/rating.ts` (+ the `isJuneApproved` source), `src/app/(site)/page.tsx`, `src/components/collection-view.tsx`/`recipe-grid.tsx` (whichever lists cards), `src/components/recipe-card.test.tsx`

- [ ] **Step 1: Re-express the rating helpers on aggregates**

Read the current `isJuneApproved` definition first. Then change `averageRating` to accept a numeric average (or keep it but add an aggregate-based path), and re-express `isJuneApproved` in terms of `{ average, count }` (preserve the existing threshold rule — confirm it from the source). Update `src/lib/rating.test.ts` accordingly.

- [ ] **Step 2: Pass aggregates into cards**

In the listing page(s), collect the visible `recipe._id`s, call `fetchQuery(api.ratings.forRecipes, { recipeIds }, token ? { token } : {})` once, and pass each card its `{ average, count }` (and derived `approved`) as props. Change `recipe-card.tsx` to read those props instead of `recipe.ratings` / `averageRating(recipe.ratings)`.

- [ ] **Step 3: Update `recipe-card.test.tsx`** for the new props. Run the card + rating tests (expect PASS).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: recipe cards show convex aggregate ratings + june-approved"
```

### Task D3: Retire the Sanity editor + rating system

**Files:** delete `src/sanity/schemaTypes/documents/editor.ts`, `src/sanity/schemaTypes/objects/rating.ts`, `src/sanity/lib/editors.ts`, `src/lib/editor-allowlist.ts`, `src/lib/rating-mutate.ts` (+ its test); modify `src/sanity/schemaTypes/index.ts`

- [ ] **Step 1: Remove from the schema registry**

In `src/sanity/schemaTypes/index.ts`, delete the `editor` and `rating` imports and their entries in the `schemaTypes` array.

- [ ] **Step 2: Delete the retired files**

```bash
git rm src/sanity/schemaTypes/documents/editor.ts \
  src/sanity/schemaTypes/objects/rating.ts \
  src/sanity/lib/editors.ts \
  src/lib/editor-allowlist.ts \
  src/lib/rating-mutate.ts
# delete rating-mutate test if present:
git rm src/lib/rating-mutate.test.ts 2>/dev/null || true
```

- [ ] **Step 3: Verify no dangling references + full gate**

```bash
grep -rn "editor-allowlist\|rating-mutate\|getEditorByEmail\|\"editor\"" src ; echo "grep exit: $?"
npx convex dev --once && npx tsc --noEmit && npm run lint && npm test
```
Expected: grep exit 1 (no matches in app code; the Sanity `rating` schema test in `schema.test.ts` may need updating — adjust it to the new schema list). All gates PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: retire sanity editor allowlist + rating object (moved to convex)"
```

---

## Phase E — Onboarding UI + membership-aware header

### Task E1: Household setup page + form

**Files:** `src/app/household/setup/page.tsx`, `src/components/household-setup.tsx`

- [ ] **Step 1: Server page (redirect members away)**

`src/app/household/setup/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { HouseholdSetup } from "@/components/household-setup";

export default async function HouseholdSetupPage() {
  const viewer = await getViewer();
  if (!viewer.isAuthenticated) redirect("/");
  if (viewer.isMember) redirect("/plan");
  return <HouseholdSetup />;
}
```

- [ ] **Step 2: Client form (create or join)**

`src/components/household-setup.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@cvx/_generated/api";

export function HouseholdSetup() {
  const router = useRouter();
  const createHousehold = useMutation(api.households.createHousehold);
  const acceptInvite = useMutation(api.households.acceptInvite);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    setError(null);
    try {
      await createHousehold({ name });
      router.push("/plan");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create household");
    }
  }
  async function onJoin() {
    setError(null);
    try {
      await acceptInvite({ code });
      router.push("/plan");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join");
    }
  }

  return (
    <div>
      {error ? <p role="alert">{error}</p> : null}
      <section>
        <h2>Create a household</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jacob & Lily" />
        <button type="button" onClick={onCreate} disabled={!name.trim()}>Create</button>
      </section>
      <section>
        <h2>Join with a code</h2>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Invite code" />
        <button type="button" onClick={onJoin} disabled={!code.trim()}>Join</button>
      </section>
    </div>
  );
}
```
> Styling follows the brand (terracotta editorial) during the Spec 3 visual pass; this task establishes structure + behavior.

- [ ] **Step 3: Commit**

```bash
git add src/app/household/setup/page.tsx src/components/household-setup.tsx
git commit -m "feat: household setup (create or join) onboarding page"
```

### Task E2: Invite panel (owner generates a code)

**Files:** `src/components/invite-panel.tsx`, mounted on `src/app/(site)/plan/page.tsx`

- [ ] **Step 1: Client component**

`src/components/invite-panel.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@cvx/_generated/api";

export function InvitePanel() {
  const createInvite = useMutation(api.households.createInvite);
  const [code, setCode] = useState<string | null>(null);
  return (
    <div>
      <button type="button" onClick={async () => setCode(await createInvite({}))}>
        Generate invite code
      </button>
      {code ? <code aria-label="invite code">{code}</code> : null}
    </div>
  );
}
```

- [ ] **Step 2: Mount for owners on the plan page**

In `src/app/(site)/plan/page.tsx`, render `<InvitePanel />` when `viewer.role === "owner"`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: owner invite-code panel on the plan page"
```

### Task E3: Membership-aware header (fix the dead Plan link)

**Files:** `src/components/auth-controls.tsx`, `src/components/auth-controls.test.tsx`

- [ ] **Step 1: Update the test** to drive off `api.households.viewer`:
```tsx
vi.mock("@cvx/_generated/api", () => ({
  api: { households: { viewer: "households.viewer" } },
}));
// signed-out: useQuery -> null  => "Sign in"
// authed, no household: useQuery -> { householdId: null, name: "Jacob" } => "Finish setup" link + Sign out
// member: useQuery -> { householdId: "h1", name: "Jacob" } => "Plan" link + name + Sign out
```
Run it (expect FAIL).

- [ ] **Step 2: Implement** — read `api.households.viewer`; show **Plan** only when `v.householdId` is set, otherwise a **Finish setup** link to `/household/setup`:
```tsx
"use client";
import Link from "next/link";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";

export function AuthControls() {
  const { signIn, signOut } = useAuthActions();
  const v = useQuery(api.households.viewer);

  if (v === undefined) return <span className="kicker text-ink-soft">···</span>;

  if (v) {
    return (
      <span className="flex items-center gap-3">
        {v.householdId ? (
          <Link href="/plan" className="kicker text-ink-soft transition-colors hover:text-terracotta">Plan</Link>
        ) : (
          <Link href="/household/setup" className="kicker text-clay transition-colors hover:text-terracotta">Finish setup</Link>
        )}
        {v.name ? <span className="kicker hidden text-ink-soft sm:inline">{v.name}</span> : null}
        <button type="button" onClick={() => void signOut()} className="kicker text-ink-soft transition-colors hover:text-terracotta">Sign out</button>
      </span>
    );
  }

  return (
    <button type="button" onClick={() => void signIn("google")} className="kicker text-ink-soft transition-colors hover:text-terracotta">Sign in</button>
  );
}
```
Run the test (expect PASS).

- [ ] **Step 3: Delete the now-unused `convex/users.ts` `me` query** if nothing else references it (grep `api.users.me`); otherwise leave it.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: membership-aware header (Plan vs Finish setup)"
```

---

## Phase F — Data migration (existing ratings)

### Task F1: One-time ratings migration

**Files:** `convex/migrations.ts`

- [ ] **Step 1: Internal mutation mapping Sanity editor ratings → Convex**

`convex/migrations.ts`:
```typescript
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Run once from the Convex dashboard / CLI after households are set up.
// `rows` is exported from Sanity: each existing rating with the rater's email.
export const importRatings = internalMutation({
  args: {
    rows: v.array(
      v.object({ recipeId: v.string(), email: v.string(), value: v.number() }),
    ),
  },
  handler: async (ctx, { rows }) => {
    for (const row of rows) {
      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", row.email))
        .unique();
      if (!user) continue; // rater hasn't signed in yet — skip
      const existing = await ctx.db
        .query("ratings")
        .withIndex("by_recipe_user", (q) =>
          q.eq("recipeId", row.recipeId).eq("userId", user._id),
        )
        .unique();
      if (!existing) {
        await ctx.db.insert("ratings", {
          recipeId: row.recipeId,
          userId: user._id,
          value: row.value,
        });
      }
    }
  },
});
```

- [ ] **Step 2: Export the rows from Sanity (manual, you)**

GROQ to gather existing ratings with rater email:
```
*[_type=="recipe" && defined(ratings)]{ "recipeId": _id, "ratings": ratings[]{ "email": editor->email, value } }
```
Flatten to `{ recipeId, email, value }[]` and pass to the mutation:
```bash
npx convex run migrations:importRatings '{"rows": [ ... ]}'
```

- [ ] **Step 3: Verify + commit**

Spot-check a recipe's `forRecipe` aggregate matches the old Sanity ratings, then:
```bash
git add convex/migrations.ts convex/_generated
git commit -m "feat: one-time importRatings migration from sanity"
```

---

## Self-review notes

- **Spec coverage (1b):** households + memberships + invites ✓ (A2, A4); onboarding gate + pages ✓ (C3, E1); auth-model swap to membership ✓ (C1–C3); any-member rating via Convex ✓ (B1, D1–D2); retire editor allowlist ✓ (D3); fix dead Plan link ✓ (E3); seed/migrate ✓ (F1). Made-it/to-try/notes intentionally remain global Sanity → **Plan 1c**.
- **Entanglement handled:** ratings moved to Convex because the Sanity rating references the `editor` doc being retired and blocks "any member can rate."
- **Naming:** `Viewer` shape changes (`isEditor`→`isMember`, adds `userId`/`householdId`/`role`/`isAuthenticated`); every consumer updated in C3.
- **Known transitional:** existing Sanity ratings not yet migrated will read as 0 until F1 runs; `markMade`/`toggleWishlist`/notes stay global until 1c.
- **convex-test** runs under `// @vitest-environment edge-runtime`; component tests stay jsdom.
