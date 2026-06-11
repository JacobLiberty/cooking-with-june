# Foundation 1c — Per-household made-it / to-try / notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Move per-recipe **made-it** (count + last-made), **to-try**, and **notes** from global Sanity fields to **per-household Convex state**, expose made-it/to-try as **browse filters**, and retire the corresponding Sanity fields/object/actions.

**Architecture:** Mirrors the 1b ratings migration. New Convex `recipeState` (one row per household+recipe: madeCount, lastMadeAt, toTry) and `recipeNotes` (per-household, author-attributed) tables, member-gated mutations, and queries that derive the household from the authed user. The home grid merges the viewer's household state onto cards (like ratings); the recipe page + EditorActions + AddNoteForm read/write Convex. Sanity `wishlist`/`madeCount`/`lastMadeAt`/`notes` fields, the `recipeNote` object, and the markMade/unmarkMade/toggleWishlist/addNote server actions are removed.

**Tech Stack:** Convex (+ convex-test), Next.js 16, Vitest.

**Scope note:** Plan 3 of 3 for Spec 1. After this, all per-recipe personal state lives in Convex (ratings global; made-it/to-try/notes per-household). Per-household pantry/grocery/plan is **Spec 2** (separate).

**Decisions baked in:** Notes = separate `recipeNotes` table (clean append/list/delete), author = the writing member's name. Existing Sanity made/to-try/notes data: an **optional** `importState` migration is provided (Phase E); start-fresh is fine (user opted to skip the ratings backfill). Reactivity uses `router.refresh()` after writes (consistent with the current EditorActions/AddNoteForm pattern).

---

## File structure

| File | Responsibility |
|---|---|
| `convex/schema.ts` (modify) | Add `recipeState`, `recipeNotes` tables |
| `convex/recipeState.ts` (create) | `mine` (household states), `forRecipe`; `setToTry`, `markMade`, `unmarkMade` mutations |
| `convex/recipeState.test.ts` (create) | convex-test coverage |
| `convex/notes.ts` (create) | `forRecipe` query; `add`, `remove` mutations |
| `convex/notes.test.ts` (create) | convex-test coverage |
| `convex/migrations.ts` (modify) | add optional `importState` internal mutation |
| `src/sanity/types.ts` (modify) | RecipeCardData: `wishlist`/`madeCount` → `toTry`/`madeCount` from Convex; RecipeDetailData drop wishlist/madeCount/lastMadeAt/notes |
| `src/sanity/lib/queries.ts` (modify) | drop wishlist/madeCount/lastMadeAt/notes projections |
| `src/app/(site)/page.tsx` (modify) | merge household state onto cards (toTry/madeCount) |
| `src/app/(site)/recipe/[slug]/page.tsx` (modify) | fetch Convex state + notes; pass to EditorActions/notes UI |
| `src/components/editor-actions.tsx` (modify) | to-try + made via Convex mutations |
| `src/components/add-note-form.tsx` (modify) | addNote via Convex mutation |
| `src/components/recipe-card.tsx` (modify) | read `recipe.toTry` / `recipe.madeCount` |
| `src/lib/recipe-filter.ts` (modify) | `totry`→`recipe.toTry`; add `made` collection |
| `src/components/filter-controls.tsx` (modify) | add a "Made it" collection facet |
| Retire | `markMade`/`unmarkMade`/`toggleWishlist`/`addNote` from recipe-actions.ts; `recipeNote` object + schema entry; Sanity recipe fields wishlist/madeCount/lastMadeAt/notes |

---

## Phase A — Convex per-household state backend

### Task A1: Schema

- [ ] Add to `convex/schema.ts`:
```typescript
  recipeState: defineTable({
    householdId: v.id("households"),
    recipeId: v.string(),
    madeCount: v.number(),
    lastMadeAt: v.optional(v.number()),
    toTry: v.boolean(),
  })
    .index("by_household", ["householdId"])
    .index("by_household_recipe", ["householdId", "recipeId"]),

  recipeNotes: defineTable({
    householdId: v.id("households"),
    recipeId: v.string(),
    userId: v.id("users"),
    author: v.optional(v.string()),
    text: v.string(),
  }).index("by_household_recipe", ["householdId", "recipeId"]),
```
- [ ] `npx convex dev --once`; commit.

### Task A2: recipeState functions (TDD)

**Files:** `convex/recipeState.ts`, `convex/recipeState.test.ts`

- [ ] Tests (convex-test, edge-runtime header + glob): a member's `markMade` increments madeCount + sets lastMadeAt; `unmarkMade` floors at 0; `setToTry` toggles; `forRecipe` returns the household's row (defaults madeCount 0 / toTry false when absent); `mine` returns all the household's rows; non-members rejected; two households are isolated (one's markMade doesn't affect the other). Run → FAIL.
- [ ] Implement `convex/recipeState.ts`:
```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getMembership, requireMembership } from "./lib/auth";

async function row(ctx, householdId, recipeId) {
  return await ctx.db
    .query("recipeState")
    .withIndex("by_household_recipe", (q) =>
      q.eq("householdId", householdId).eq("recipeId", recipeId),
    )
    .unique();
}

export const forRecipe = query({
  args: { recipeId: v.string() },
  handler: async (ctx, { recipeId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { madeCount: 0, lastMadeAt: null, toTry: false };
    const m = await getMembership(ctx, userId);
    if (!m) return { madeCount: 0, lastMadeAt: null, toTry: false };
    const r = await row(ctx, m.householdId, recipeId);
    return {
      madeCount: r?.madeCount ?? 0,
      lastMadeAt: r?.lastMadeAt ?? null,
      toTry: r?.toTry ?? false,
    };
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const m = await getMembership(ctx, userId);
    if (!m) return [];
    const rows = await ctx.db
      .query("recipeState")
      .withIndex("by_household", (q) => q.eq("householdId", m.householdId))
      .collect();
    return rows.map((r) => ({
      recipeId: r.recipeId,
      madeCount: r.madeCount,
      toTry: r.toTry,
    }));
  },
});

async function upsert(ctx, recipeId, patch) {
  const { householdId } = await requireMembership(ctx);
  const existing = await row(ctx, householdId, recipeId);
  if (existing) {
    await ctx.db.patch(existing._id, patch(existing));
    return;
  }
  await ctx.db.insert("recipeState", {
    householdId,
    recipeId,
    madeCount: 0,
    toTry: false,
    ...patch({ madeCount: 0, toTry: false }),
  });
}

export const markMade = mutation({
  args: { recipeId: v.string(), at: v.number() },
  handler: (ctx, { recipeId, at }) =>
    upsert(ctx, recipeId, (cur) => ({
      madeCount: (cur.madeCount ?? 0) + 1,
      lastMadeAt: at,
    })),
});

export const unmarkMade = mutation({
  args: { recipeId: v.string() },
  handler: (ctx, { recipeId }) =>
    upsert(ctx, recipeId, (cur) => ({
      madeCount: Math.max(0, (cur.madeCount ?? 0) - 1),
    })),
});

export const setToTry = mutation({
  args: { recipeId: v.string(), value: v.boolean() },
  handler: (ctx, { recipeId, value }) =>
    upsert(ctx, recipeId, () => ({ toTry: value })),
});
```
(Add explicit Convex types to the helpers to satisfy tsc; `at` is `Date.now()` from the client.)
- [ ] Run → PASS; `npx convex dev --once`; commit.

### Task A3: notes functions (TDD)

**Files:** `convex/notes.ts`, `convex/notes.test.ts`

- [ ] Tests: member `add` inserts a note with author; `forRecipe` lists the household's notes (oldest→newest); empty/over-500 text rejected; non-member rejected; households isolated; `remove` deletes own household's note. Run → FAIL.
- [ ] Implement `convex/notes.ts`: `forRecipe(recipeId)` → list `{_id, author, text}` by `by_household_recipe`; `add(recipeId, text)` → requireMembership, validate `1..500` trimmed, resolve author from `users.name`, insert; `remove(noteId)` → requireMembership, verify the note's householdId matches before delete. Run → PASS; push; commit.

---

## Phase B — Recipe page + EditorActions + notes on Convex

### Task B1: EditorActions (to-try + made via Convex)

- [ ] In `src/components/editor-actions.tsx`: replace `toggleWishlist`/`markMade`/`unmarkMade` server-action imports with `useMutation(api.recipeState.setToTry / markMade / unmarkMade)`. Keep optimistic local state + `router.refresh()` after the write resolves (same pattern as rating). `made()` calls `markMade({ recipeId, at: Date.now() })`; Undo calls `unmarkMade({ recipeId })`; to-try button calls `setToTry({ recipeId, value: next })`. Update `editor-actions.test.tsx` mocks (these become Convex mutations).
- [ ] Run the component test → PASS.

### Task B2: Recipe page reads Convex state + notes

- [ ] In `src/app/(site)/recipe/[slug]/page.tsx`: fetch `api.recipeState.forRecipe` and `api.notes.forRecipe` (server, with token), guarded with `.catch` fallbacks. Use `state.madeCount` for the "made N×" line and `state.toTry` for `EditorActions initialToTry`. Render the notes list from the Convex notes (author + text). Remove `recipe.madeCount` / `recipe.wishlist` / `recipe.notes` usage.
- [ ] `AddNoteForm`: switch to `useMutation(api.notes.add)`; on success clear + `router.refresh()`. Update its test.
- [ ] tsc + tests → PASS; commit B.

---

## Phase C — Home grid + filters (per-household)

### Task C1: Merge household state onto cards

- [ ] In `src/app/(site)/page.tsx`: after recipes, `fetchQuery(api.recipeState.mine, {}, token ? {token} : {})` (guarded `.catch(()=>[])`), build a map by recipeId, and merge `toTry` + `madeCount` onto each `RecipeCardData` (default false/0). Update `RawRecipe`/`RecipeCardData` so `toTry`/`madeCount` come from the merge, not Sanity.
- [ ] `recipe-card.tsx`: read `recipe.toTry` / `recipe.madeCount` (rename from wishlist).
- [ ] tsc → PASS.

### Task C2: Filters — to-try + made

- [ ] `src/lib/recipe-filter.ts`: `matchesCollection` `totry` → `recipe.toTry`; add `made` → `recipe.madeCount > 0`; add `"made"` to `CollectionKey`. Update `recipe-filter.test.ts` fixtures (toTry/madeCount).
- [ ] `src/components/filter-controls.tsx`: add a **"Made it"** option to the collection facet (next to "To try"). Update its test if it asserts the option list.
- [ ] tests → PASS; commit C.

---

## Phase D — Retire Sanity made/to-try/notes

- [ ] `recipe-actions.ts`: delete `toggleWishlist`, `markMade`, `unmarkMade`, `addNote`; on create, stop setting `wishlist`/`madeCount`. Update recipe-actions.test.
- [ ] `queries.ts`: remove `wishlist`/`madeCount`/`lastMadeAt`/`notes` projections.
- [ ] `recipe.ts` schema: remove `wishlist`, `madeCount`, `lastMadeAt`, `notes` fields; `schemaTypes/index.ts`: remove `recipeNote`; delete `objects/recipe-note.ts`. Update `schema.test.ts`.
- [ ] `types.ts`: drop the retired RecipeDetailData fields + RecipeNoteView if unused.
- [ ] Full gate (convex push + tsc + lint + tests) → PASS; commit D.

---

## Phase E — Optional migration (user-run)

- [ ] Add `importState` internal mutation to `convex/migrations.ts`: args `rows: [{recipeId, madeCount, lastMadeAt?, toTry}]` + a `householdId` (or resolve the single household); upsert into recipeState. Document the Sanity export GROQ (`*[_type=="recipe"]{ "recipeId": _id, madeCount, lastMadeAt, "toTry": wishlist }`) and the `npx convex run` command. Optional — skip if starting fresh.

---

## Self-review notes
- **Spec coverage:** made-it/to-try/notes per-household ✓ (A,B); filters ✓ (C2); retire Sanity ✓ (D); migration optional ✓ (E).
- **Pattern reuse:** identical to 1b ratings (merge-on-server for the grid, guarded fetches, router.refresh reactivity).
- **Isolation:** all state keyed by householdId derived from the authed user; two households can't see each other's made/to-try/notes (tested A2/A3).
- **After 1c:** Sanity recipe doc holds only content; all personal state is in Convex. Pantry/grocery/plan remain global → **Spec 2**.
