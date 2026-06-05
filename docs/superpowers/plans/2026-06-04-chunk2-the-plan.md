# Chunk 2 — The Plan (Model A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps; TDD where marked.

**Goal:** A shared household meal-planner at `/plan` (editor-gated): add recipes to the plan, get an auto grocery list (deduped by ingredient, amounts in brackets) plus manual items, check off / delete items, and a master "mark all got" toggle.

**Spec:** `docs/superpowers/specs/2026-06-04-enhancements-and-the-plan.md` (section E). **Model A:** one shared `mealPlan` singleton for all editors.

**Conventions:** App code uses `@/`. Imports inside `src/sanity/schemaTypes/**` use RELATIVE paths. Don't touch `src/sanity/env.ts`, `sanity.config.ts`, `sanity.cli.ts`, `.env*`. Design per `design.md` (terracotta/clay, kicker, Caslon/Newsreader, `PawMark`, no emoji). Builds: `NEXT_PUBLIC_SANITY_PROJECT_ID=zwjctldy NEXT_PUBLIC_SANITY_DATASET=production npm run build`.

**Scope note:** "Add to plan" lives on the **recipe detail page** for this MVP. Adding it to recipe *cards* is a deferred follow-up (needs plan-membership threading through the grid) — note it, don't build it.

**After build:** the new `mealPlan` schema must be deployed to the Content Lake for the singleton to validate in Studio, but the app works regardless (the JS write client doesn't require it). The controller will run `npx sanity schema deploy` separately if needed.

---

## File Structure
Created:
- `src/sanity/schemaTypes/documents/meal-plan.ts` — `mealPlan` singleton schema
- `src/sanity/schemaTypes/objects/manual-item.ts` — `manualGroceryItem` object
- `src/lib/grocery.ts` + `.test.ts` — `buildGroceryList()` (TDD)
- `src/sanity/lib/plan-queries.ts` — `PLAN_QUERY`, `PLAN_RECIPE_IDS_QUERY`
- `src/sanity/plan-types.ts` — plan result types
- `src/app/actions/plan-actions.ts` — `"use server"` plan actions
- `src/components/add-to-plan-button.tsx` — client toggle (detail page)
- `src/components/plan-view.tsx` — client grocery list (check/delete/manual/all)
- `src/app/(site)/plan/page.tsx` — gated plan page
Modified:
- `src/sanity/schemaTypes/index.ts` — register the two new types
- `src/lib/nav.ts` — (no change; Plan link is viewer-gated, added in the header)
- `src/components/site-header.tsx` — show a "Plan" link for editors
- `src/app/(site)/recipe/[slug]/page.tsx` — `<AddToPlanButton>` for editors

---

## Task 1: Schema — mealPlan singleton + manual item

- [ ] **Step 1: `src/sanity/schemaTypes/objects/manual-item.ts`**
```ts
import { defineType, defineField } from "sanity";

export const manualGroceryItem = defineType({
  name: "manualGroceryItem",
  title: "Manual grocery item",
  type: "object",
  fields: [
    defineField({ name: "name", type: "string", validation: (r) => r.required() }),
    defineField({ name: "gotIt", type: "boolean", initialValue: false }),
  ],
  preview: {
    select: { title: "name", got: "gotIt" },
    prepare({ title, got }) {
      return { title, subtitle: got ? "got it" : undefined };
    },
  },
});
```

- [ ] **Step 2: `src/sanity/schemaTypes/documents/meal-plan.ts`**
```ts
import { defineType, defineField, defineArrayMember } from "sanity";
import { CalendarIcon } from "@sanity/icons";

export const mealPlan = defineType({
  name: "mealPlan",
  title: "Meal plan",
  type: "document",
  icon: CalendarIcon,
  description:
    "The shared household plan + grocery list. There is a single document with id 'mealPlan'.",
  fields: [
    defineField({
      name: "recipes",
      title: "Planned recipes",
      type: "array",
      of: [defineArrayMember({ type: "reference", to: [{ type: "recipe" }] })],
    }),
    defineField({
      name: "manualItems",
      title: "Manual grocery items",
      type: "array",
      of: [defineArrayMember({ type: "manualGroceryItem" })],
    }),
    defineField({
      name: "checkedIngredients",
      title: "Checked-off ingredient ids",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
    }),
  ],
  preview: { prepare: () => ({ title: "Meal plan" }) },
});
```

- [ ] **Step 3: Register in `src/sanity/schemaTypes/index.ts`** — import `mealPlan` and `manualGroceryItem` and add to the `schemaTypes` array (mealPlan under documents, manualGroceryItem under objects).

- [ ] **Step 4: Extend the schema guard test** `src/sanity/schemaTypes/schema.test.ts` — add `"mealPlan"` and `"manualGroceryItem"` to the `arrayContaining([...])` of registered type names.

- [ ] **Step 5:** `npx vitest run src/sanity/schemaTypes/schema.test.ts` (PASS), `npx tsc --noEmit`. Commit: `git add src/sanity/schemaTypes && git commit -m "feat: mealPlan singleton schema + manual grocery item"`

---

## Task 2: buildGroceryList (TDD)

- [ ] **Step 1: Test `src/lib/grocery.test.ts`**
```ts
import { describe, it, expect } from "vitest";
import { buildGroceryList, type PlanIngredient } from "@/lib/grocery";

function ing(
  ingredientId: string,
  name: string,
  quantity?: string,
  unit?: string,
): PlanIngredient {
  return { ingredientId, name, quantity, unit };
}

describe("buildGroceryList", () => {
  it("dedupes by ingredient and collects amounts", () => {
    const list = buildGroceryList([
      [ing("onion", "onion", "1", ""), ing("cream", "cream", "1", "cup")],
      [ing("onion", "onion", "2", ""), ing("cream", "cream", "0.5", "L")],
    ]);
    const onion = list.find((i) => i.ingredientId === "onion");
    const cream = list.find((i) => i.ingredientId === "cream");
    expect(list).toHaveLength(2);
    expect(onion?.amounts).toEqual(["1", "2"]);
    expect(cream?.amounts).toEqual(["1 cup", "0.5 L"]);
  });

  it("skips ingredients with no id and omits empty amounts", () => {
    const list = buildGroceryList([
      [ing("", "mystery"), ing("salt", "salt")], // no-id dropped; salt has no amount
    ]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ ingredientId: "salt", name: "salt", amounts: [] });
  });

  it("does not duplicate an amount string", () => {
    const list = buildGroceryList([
      [ing("egg", "egg", "2", "")],
      [ing("egg", "egg", "2", "")],
    ]);
    expect(list[0].amounts).toEqual(["2"]);
  });
});
```

- [ ] **Step 2:** Run — FAIL.

- [ ] **Step 3: `src/lib/grocery.ts`**
```ts
export type PlanIngredient = {
  ingredientId: string | null;
  name: string | null;
  quantity?: string;
  unit?: string;
};

export type GroceryItem = {
  ingredientId: string;
  name: string;
  amounts: string[];
};

function amountOf(line: PlanIngredient): string {
  return [line.quantity, line.unit].filter(Boolean).join(" ").trim();
}

/** Aggregate ingredient lines across planned recipes, deduped by ingredient id,
 *  collecting distinct amount strings. Sorted by name. */
export function buildGroceryList(
  recipes: PlanIngredient[][],
): GroceryItem[] {
  const byId = new Map<string, GroceryItem>();
  for (const lines of recipes) {
    for (const line of lines) {
      if (!line.ingredientId) continue;
      const existing = byId.get(line.ingredientId) ?? {
        ingredientId: line.ingredientId,
        name: line.name ?? line.ingredientId,
        amounts: [],
      };
      const amount = amountOf(line);
      if (amount && !existing.amounts.includes(amount)) {
        existing.amounts.push(amount);
      }
      byId.set(line.ingredientId, existing);
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}
```

- [ ] **Step 4:** Run — PASS. Commit: `git add src/lib/grocery.ts src/lib/grocery.test.ts && git commit -m "feat: buildGroceryList aggregation helper"`

---

## Task 3: Plan queries + types

- [ ] **Step 1: `src/sanity/plan-types.ts`**
```ts
import type { SanityImageSource } from "@sanity/image-url/lib/types/types";
import type { PlanIngredient } from "@/lib/grocery";

export type PlanRecipe = {
  _id: string;
  title: string;
  slug: string;
  coverImage?: SanityImageSource | null;
  ingredients: PlanIngredient[] | null;
};

export type ManualItem = { _key: string; name: string; gotIt: boolean };

export type PlanData = {
  recipes: PlanRecipe[] | null;
  manualItems: ManualItem[] | null;
  checkedIngredients: string[] | null;
};
```

- [ ] **Step 2: `src/sanity/lib/plan-queries.ts`**
```ts
import { defineQuery } from "next-sanity";

export const PLAN_QUERY = defineQuery(`
  *[_id == "mealPlan"][0]{
    "recipes": recipes[]->{
      _id,
      title,
      "slug": slug.current,
      "coverImage": images[0],
      "ingredients": ingredients[]{
        "ingredientId": ingredient._ref,
        "name": ingredient->name,
        quantity,
        unit
      }
    },
    manualItems[]{ _key, name, gotIt },
    checkedIngredients
  }
`);

export const PLAN_RECIPE_IDS_QUERY = defineQuery(`
  *[_id == "mealPlan"][0].recipes[]._ref
`);
```

- [ ] **Step 3:** `npx tsc --noEmit`. Commit: `git add src/sanity/plan-types.ts src/sanity/lib/plan-queries.ts && git commit -m "feat: plan query + types"`

---

## Task 4: Plan server actions (editor-gated, shared singleton)

- [ ] **Step 1: `src/app/actions/plan-actions.ts`**
```ts
"use server";

import { revalidatePath } from "next/cache";
import { getWriteClient } from "@/sanity/lib/write-client";
import { client } from "@/sanity/lib/client";
import { requireEditor } from "@/lib/viewer";

const PLAN_ID = "mealPlan";
const reader = () => client.withConfig({ useCdn: false });

async function ensurePlan(write: ReturnType<typeof getWriteClient>) {
  await write.createIfNotExists({
    _id: PLAN_ID,
    _type: "mealPlan",
    recipes: [],
    manualItems: [],
    checkedIngredients: [],
  });
}

async function assertRecipe(recipeId: string) {
  const doc = await reader().fetch<{ _type: string } | null>(
    `*[_id == $id][0]{ _type }`,
    { id: recipeId },
  );
  if (doc?._type !== "recipe") throw new Error("Target is not a recipe");
}

export async function addToPlan(recipeId: string) {
  await requireEditor();
  await assertRecipe(recipeId);
  const write = getWriteClient();
  await ensurePlan(write);
  await write
    .patch(PLAN_ID)
    .setIfMissing({ recipes: [] })
    .append("recipes", [
      { _key: recipeId, _type: "reference", _ref: recipeId },
    ])
    .commit();
  revalidatePath("/plan");
  revalidatePath(`/recipe`, "layout");
}

export async function removeFromPlan(recipeId: string) {
  await requireEditor();
  const write = getWriteClient();
  await write
    .patch(PLAN_ID)
    .unset([`recipes[_ref=="${recipeId}"]`])
    .commit();
  revalidatePath("/plan");
  revalidatePath(`/recipe`, "layout");
}

export async function toggleIngredientGot(ingredientId: string) {
  await requireEditor();
  const write = getWriteClient();
  await ensurePlan(write);
  const checked = await reader().fetch<string[] | null>(
    `*[_id == $id][0].checkedIngredients`,
    { id: PLAN_ID },
  );
  const set = new Set(checked ?? []);
  if (set.has(ingredientId)) set.delete(ingredientId);
  else set.add(ingredientId);
  await write.patch(PLAN_ID).set({ checkedIngredients: [...set] }).commit();
  revalidatePath("/plan");
}

export async function addManualItem(name: string) {
  await requireEditor();
  const clean = name.trim();
  if (!clean) return { ok: false, error: "Item is empty" };
  if (clean.length > 120) return { ok: false, error: "Too long (max 120)" };
  const write = getWriteClient();
  await ensurePlan(write);
  await write
    .patch(PLAN_ID)
    .setIfMissing({ manualItems: [] })
    .append("manualItems", [
      { _key: crypto.randomUUID(), _type: "manualGroceryItem", name: clean, gotIt: false },
    ])
    .commit();
  revalidatePath("/plan");
  return { ok: true };
}

export async function toggleManualItem(key: string) {
  await requireEditor();
  const write = getWriteClient();
  const got = await reader().fetch<boolean | null>(
    `*[_id == $id][0].manualItems[_key == $key][0].gotIt`,
    { id: PLAN_ID, key },
  );
  await write
    .patch(PLAN_ID)
    .set({ [`manualItems[_key=="${key}"].gotIt`]: !got })
    .commit();
  revalidatePath("/plan");
}

export async function deleteManualItem(key: string) {
  await requireEditor();
  const write = getWriteClient();
  await write.patch(PLAN_ID).unset([`manualItems[_key=="${key}"]`]).commit();
  revalidatePath("/plan");
}

export async function setAllGot(got: boolean) {
  await requireEditor();
  const write = getWriteClient();
  await ensurePlan(write);
  const plan = await reader().fetch<{
    ingredientIds: string[] | null;
    manualKeys: string[] | null;
  } | null>(
    `*[_id == $id][0]{
      "ingredientIds": recipes[]->ingredients[].ingredient._ref,
      "manualKeys": manualItems[]._key
    }`,
    { id: PLAN_ID },
  );
  const patch = write.patch(PLAN_ID).set({
    checkedIngredients: got ? [...new Set(plan?.ingredientIds ?? [])] : [],
  });
  for (const key of plan?.manualKeys ?? []) {
    patch.set({ [`manualItems[_key=="${key}"].gotIt`]: got });
  }
  await patch.commit();
  revalidatePath("/plan");
}
```
> Note: `append` with `_key: recipeId` keeps a recipe from being added twice (same key → Sanity replaces). `revalidatePath("/recipe", "layout")` refreshes the detail pages' add-button state.

- [ ] **Step 2:** `npx tsc --noEmit`. Commit: `git add src/app/actions/plan-actions.ts && git commit -m "feat: editor-gated plan server actions (shared mealPlan singleton)"`

---

## Task 5: Action guard tests

- [ ] **Step 1: `src/app/actions/plan-actions.test.ts`** — mock `@/lib/viewer`, `@/sanity/lib/write-client` (return a chainable stub), `@/sanity/lib/client`, `next/cache`. Test:
  - `addManualItem("  ")` → `{ ok:false, error:"Item is empty" }`; a 121-char name → too-long error.
  - non-editor: `requireEditor` rejects → `addToPlan`, `toggleIngredientGot`, `addManualItem` all reject with "Not authorized".
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireEditor } from "@/lib/viewer";
import {
  addToPlan,
  toggleIngredientGot,
  addManualItem,
} from "@/app/actions/plan-actions";

const chain: Record<string, unknown> = {};
["setIfMissing", "append", "set", "unset", "patch"].forEach((m) => {
  chain[m] = vi.fn(() => chain);
});
(chain as { commit: unknown }).commit = vi.fn().mockResolvedValue({});

vi.mock("@/lib/viewer", () => ({ requireEditor: vi.fn() }));
vi.mock("@/sanity/lib/write-client", () => ({
  getWriteClient: vi.fn(() => ({
    createIfNotExists: vi.fn().mockResolvedValue({}),
    patch: vi.fn(() => chain),
  })),
}));
vi.mock("@/sanity/lib/client", () => ({
  client: { withConfig: () => ({ fetch: vi.fn().mockResolvedValue(null) }) },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockRequireEditor = vi.mocked(requireEditor);

beforeEach(() => {
  mockRequireEditor.mockReset();
  mockRequireEditor.mockResolvedValue({ editorId: "e1", isEditor: true, name: "Jacob" });
});

describe("plan action guards", () => {
  it("rejects empty / over-long manual items", async () => {
    expect(await addManualItem("   ")).toEqual({ ok: false, error: "Item is empty" });
    expect(await addManualItem("x".repeat(121))).toEqual({
      ok: false,
      error: "Too long (max 120)",
    });
  });

  it("propagates the authorization error for non-editors", async () => {
    mockRequireEditor.mockRejectedValue(new Error("Not authorized: editors only"));
    await expect(addToPlan("r1")).rejects.toThrow("Not authorized");
    await expect(toggleIngredientGot("i1")).rejects.toThrow("Not authorized");
    await expect(addManualItem("milk")).rejects.toThrow("Not authorized");
  });
});
```
- [ ] **Step 2:** Run — PASS. Commit: `git add src/app/actions/plan-actions.test.ts && git commit -m "test: plan action guards"`

---

## Task 6: AddToPlanButton + recipe-detail wiring + Plan nav link

- [ ] **Step 1: `src/components/add-to-plan-button.tsx`**
```tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { addToPlan, removeFromPlan } from "@/app/actions/plan-actions";

export function AddToPlanButton({
  recipeId,
  inPlan,
}: {
  recipeId: string;
  inPlan: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function go() {
    start(async () => {
      if (inPlan) await removeFromPlan(recipeId);
      else await addToPlan(recipeId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={go}
      disabled={pending}
      aria-pressed={inPlan}
      className={`kicker border px-3 py-1 disabled:opacity-50 ${
        inPlan
          ? "border-terracotta bg-terracotta-wash text-terracotta"
          : "border-terracotta/40 text-terracotta hover:bg-terracotta-wash"
      }`}
    >
      {inPlan ? "In your plan" : "Add to plan"}
    </button>
  );
}
```

- [ ] **Step 2: Recipe detail** (`src/app/(site)/recipe/[slug]/page.tsx`) — when `viewer.isEditor`, fetch whether this recipe is in the plan and render the button with the other header actions:
  - Add import: `import { AddToPlanButton } from "@/components/add-to-plan-button";` and `import { PLAN_RECIPE_IDS_QUERY } from "@/sanity/lib/plan-queries";`
  - After the existing `recipe`/`viewer` fetch, add: `const plannedIds = viewer.isEditor ? await client.withConfig({ useCdn: false }).fetch<string[] | null>(PLAN_RECIPE_IDS_QUERY) : null;`
  - In the header actions row (with Cook mode / Edit / Share), render for editors: `{viewer.isEditor ? <AddToPlanButton recipeId={recipe._id} inPlan={Boolean(plannedIds?.includes(recipe._id))} /> : null}`

- [ ] **Step 3: "Plan" nav link for editors** — in `src/components/site-header.tsx`, the header is a server component; it can read the viewer. Add `import { getViewer } from "@/lib/viewer";`, make `SiteHeader` async, `const viewer = await getViewer();`, and render a Plan link in the nav before `<AuthControls />`: `{viewer.isEditor ? <Link href="/plan" className="kicker text-ink-soft transition-colors hover:text-terracotta">Plan</Link> : null}`.
  - NOTE: making `SiteHeader` call `auth()` would make every page dynamic. Most pages are ALREADY dynamic (home + recipe use `getViewer`). `/about` is static — to avoid forcing it dynamic, do NOT call `auth()` in the shared header. INSTEAD add the Plan link as a client element inside `AuthControls` (which already uses `useSession`): show a `<a href="/plan">Plan</a>` when `session?.user?.isEditor`. Implement it there to keep static pages static.
  - So: edit `src/components/auth-controls.tsx` — when authenticated AND `session.user.isEditor`, render a "Plan" link (Next `<Link>`) alongside the name/sign-out.

- [ ] **Step 4:** `npx tsc --noEmit`, env-build. Commit: `git add src/components/add-to-plan-button.tsx "src/app/(site)/recipe/[slug]/page.tsx" src/components/auth-controls.tsx && git commit -m "feat: add-to-plan button + editor Plan nav link"`

---

## Task 7: The /plan page + PlanView

- [ ] **Step 1: `src/components/plan-view.tsx`** (client) — receives the computed grocery items (to-get + got), manual items, and planned recipe summaries; renders:
  - **Planned recipes:** a list/grid of the recipes with a "Remove" (calls `removeFromPlan`).
  - **Grocery list:** a master checkbox (calls `setAllGot`), then "To get" items (each: a checkbox → `toggleIngredientGot`/`toggleManualItem`, name + amounts in brackets, and for manual items a delete → `deleteManualItem`), then a muted "Got it" section of checked items (toggleable back).
  - **Add item** input → `addManualItem` + `router.refresh()`.
  - Use `useTransition` + `router.refresh()` after each action. Terracotta/clay, kicker, PawMark where apt. Provide accessible labels/`aria` on checkboxes and the add input.
```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { GroceryItem } from "@/lib/grocery";
import type { PlanRecipe, ManualItem } from "@/sanity/plan-types";
import {
  removeFromPlan,
  toggleIngredientGot,
  addManualItem,
  toggleManualItem,
  deleteManualItem,
  setAllGot,
} from "@/app/actions/plan-actions";

export function PlanView({
  recipes,
  toGet,
  got,
  manual,
}: {
  recipes: PlanRecipe[];
  toGet: GroceryItem[];
  got: GroceryItem[];
  manual: ManualItem[];
}) {
  const [pending, start] = useTransition();
  const [newItem, setNewItem] = useState("");
  const router = useRouter();
  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  const manualToGet = manual.filter((m) => !m.gotIt);
  const manualGot = manual.filter((m) => m.gotIt);
  const nothing =
    recipes.length === 0 && toGet.length === 0 && got.length === 0 && manual.length === 0;

  return (
    <div className="space-y-10" aria-busy={pending}>
      {/* planned recipes */}
      <section aria-labelledby="planned-heading">
        <h2 id="planned-heading" className="kicker text-terracotta">
          Planned recipes
        </h2>
        {recipes.length === 0 ? (
          <p className="mt-2 text-ink-soft">
            Nothing planned yet — add recipes from their pages.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {recipes.map((r) => (
              <li key={r._id} className="flex items-center justify-between gap-3">
                <Link href={`/recipe/${r.slug}`} className="text-ink hover:text-terracotta">
                  {r.title}
                </Link>
                <button
                  type="button"
                  onClick={() => run(() => removeFromPlan(r._id))}
                  className="kicker text-ink-soft hover:text-clay"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* grocery list */}
      <section aria-labelledby="grocery-heading">
        <div className="flex items-center justify-between">
          <h2 id="grocery-heading" className="kicker text-terracotta">
            Grocery list
          </h2>
          {toGet.length + manualToGet.length + got.length + manualGot.length > 0 ? (
            <button
              type="button"
              onClick={() => run(() => setAllGot(manualToGet.length + toGet.length > 0))}
              className="kicker text-ink-soft hover:text-terracotta"
            >
              {manualToGet.length + toGet.length > 0 ? "Mark all got" : "Clear all"}
            </button>
          ) : null}
        </div>

        <ul className="mt-3 space-y-1.5">
          {toGet.map((g) => (
            <li key={g.ingredientId} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={false}
                onChange={() => run(() => toggleIngredientGot(g.ingredientId))}
                aria-label={`Got ${g.name}`}
              />
              <span className="text-ink">
                {g.name}
                {g.amounts.length ? (
                  <span className="text-ink-soft"> ({g.amounts.join(" · ")})</span>
                ) : null}
              </span>
            </li>
          ))}
          {manualToGet.map((m) => (
            <li key={m._key} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={false}
                onChange={() => run(() => toggleManualItem(m._key))}
                aria-label={`Got ${m.name}`}
              />
              <span className="flex-1 text-ink">{m.name}</span>
              <button
                type="button"
                onClick={() => run(() => deleteManualItem(m._key))}
                aria-label={`Delete ${m.name}`}
                className="kicker text-ink-soft hover:text-clay"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = newItem.trim();
            if (!t) return;
            run(async () => {
              await addManualItem(t);
              setNewItem("");
            });
          }}
          className="mt-3 flex items-center gap-3"
        >
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            maxLength={120}
            aria-label="Add a grocery item"
            placeholder="Add an item (e.g. milk for coffee)…"
            className="flex-1 border-b border-ink/25 bg-transparent pb-1 text-ink placeholder:text-ink-soft/60 focus:border-terracotta"
          />
          <button type="submit" className="kicker text-terracotta hover:text-terracotta-deep">
            Add
          </button>
        </form>

        {got.length + manualGot.length > 0 ? (
          <div className="mt-6">
            <p className="kicker text-ink-soft">Got it</p>
            <ul className="mt-2 space-y-1.5">
              {got.map((g) => (
                <li key={g.ingredientId} className="flex items-center gap-3 text-ink-soft">
                  <input
                    type="checkbox"
                    checked
                    onChange={() => run(() => toggleIngredientGot(g.ingredientId))}
                    aria-label={`Un-check ${g.name}`}
                  />
                  <span className="line-through">{g.name}</span>
                </li>
              ))}
              {manualGot.map((m) => (
                <li key={m._key} className="flex items-center gap-3 text-ink-soft">
                  <input
                    type="checkbox"
                    checked
                    onChange={() => run(() => toggleManualItem(m._key))}
                    aria-label={`Un-check ${m.name}`}
                  />
                  <span className="flex-1 line-through">{m.name}</span>
                  <button
                    type="button"
                    onClick={() => run(() => deleteManualItem(m._key))}
                    aria-label={`Delete ${m.name}`}
                    className="kicker hover:text-clay"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {nothing ? null : null}
    </div>
  );
}
```

- [ ] **Step 2: `src/app/(site)/plan/page.tsx`** (gated server page)
```tsx
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { client } from "@/sanity/lib/client";
import { PLAN_QUERY } from "@/sanity/lib/plan-queries";
import type { PlanData } from "@/sanity/plan-types";
import { buildGroceryList } from "@/lib/grocery";
import { PlanView } from "@/components/plan-view";

export default async function PlanPage() {
  const viewer = await getViewer();
  if (!viewer.isEditor) redirect("/");

  const plan = await client
    .withConfig({ useCdn: false })
    .fetch<PlanData | null>(PLAN_QUERY);

  const recipes = plan?.recipes ?? [];
  const checked = new Set(plan?.checkedIngredients ?? []);
  const all = buildGroceryList(recipes.map((r) => r.ingredients ?? []));
  const toGet = all.filter((g) => !checked.has(g.ingredientId));
  const got = all.filter((g) => checked.has(g.ingredientId));

  return (
    <section className="mx-auto max-w-2xl">
      <header className="set set-1">
        <p className="kicker text-terracotta">This week</p>
        <h1 className="editorial-display mt-2 text-5xl text-ink md:text-6xl">
          The Plan
        </h1>
        <div className="rule-draw mt-5 h-px w-full bg-terracotta/40" />
      </header>
      <div className="set set-2 mt-8">
        <PlanView
          recipes={recipes}
          toGet={toGet}
          got={got}
          manual={plan?.manualItems ?? []}
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 3:** Verify — `npm test`, `npm run lint`, `npx tsc --noEmit`, env-build (route `/plan` present, dynamic). Commit: `git add src/components/plan-view.tsx "src/app/(site)/plan" && git commit -m "feat: /plan page with shared grocery list (auto + manual, check/delete/all)"`

---

## Task 8: Phase gate
- [ ] `npm test` (prior 68 + grocery 3 + plan-actions 2 + schema test still passes = ~73), `npm run lint` (0), `npx tsc --noEmit`, `npm audit` (0), env-build. Report. Note: live editing of the plan needs `SANITY_API_WRITE_TOKEN` at runtime (already documented); the new schema should be deployed via `npx sanity schema deploy` by the controller.

---

## Self-Review
**Spec coverage (E):** shared `mealPlan` singleton (Model A) ✓; add/remove recipe ✓; auto grocery deduped by ingredient + amounts in brackets (`buildGroceryList`) ✓; manual items add/check/delete ✓; per-item check + master "all got"/clear ✓; editor-gated page + nav link ✓. **Security:** every action `requireEditor()` first; `addToPlan` `assertRecipe()`; manual name validated/capped; write token server-only; page redirects non-editors. The `mealPlan` doc is in the public dataset (plan/grocery queryable) — flagged in the spec, acceptable for v1. **Design:** terracotta/clay, kicker, no emoji. **Types:** `PlanIngredient`/`GroceryItem` (grocery.ts) ↔ `PlanRecipe`/`PlanData` (plan-types) ↔ queries ↔ PlanView. **Deferred (noted):** add-to-plan on cards; per-auto-item delete (auto items are check-only; manual items delete). **Risk:** GROQ `unset`/`set` with interpolated `_key`/`_ref` — keys are server-generated UUIDs / Sanity ids (not free user text), so no injection; still, the values come from our own ids. Singleton created via `createIfNotExists`.
