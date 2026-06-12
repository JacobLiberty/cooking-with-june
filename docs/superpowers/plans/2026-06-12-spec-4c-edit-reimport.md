# Spec 4c — Edit / Re-import + Retire Manual Form

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Spec 4: a light text-only edit form (`editRecipeText`), a "Re-import" flow that re-runs the pipeline and republishes over the same recipe id (preserving slug + Convex ratings/made/notes), and retirement of the old `recipe-form` create/ingredient path so the import pipeline is the only way ingredients enter a recipe.

**Architecture:** `publishRecipe` gains an optional `recipeId` → PATCH the existing recipe (keep slug + images, no cover regen) instead of creating. `editRecipeText` patches text fields only. The `/recipe/[slug]/edit` page renders a trimmed `RecipeEditForm` (no ingredient editing) + a "Re-import" link to `/submit?reimport=<id>`, which prefills the paste box from a `recipeToBlurb(recipe)` rendering and routes publish through the same id. `recipe-form.tsx` + `saveRecipe` are deleted.

**Tech Stack:** Next.js 16 (server actions + client form), Sanity write client, Vitest + Testing Library.

---

## Context the implementer needs

- 4b built `publishRecipe(draft)` in `src/app/actions/publish-actions.ts` (create path) and `ImportReview` (`src/components/import-review.tsx`, props `{ tags }`).
- `RECIPE_EDIT_QUERY` → `RecipeEditData` (`src/sanity/types.ts`): `{ _id, title, slug, description?, story?, prepTime?, cookTime?, servings?, ingredients: {_key,quantity?,unit?,note?,optional?,ingredientId,name}[]|null, steps: string[]|null, tagIds: string[]|null, hasImage }`.
- `recipe-actions.ts` currently has `saveRecipe` (create+edit, RETIRE), `deleteRecipe` (KEEP — used by `delete-recipe-button.tsx`), `assertRecipe`, `safeRecipeId`, `reader`. `saveRecipe`'s text-edit path patches `write.patch(recipeId).set(doc).commit()`. `deleteRecipe` still patches the now-deleted `mealPlan` doc inside a try/catch (dead — clean it up).
- The `/recipe/[slug]/edit` page renders `<RecipeForm recipeId initial ingredients tags />`. `recipe-form.tsx` is ONLY used by that page now (`/recipe/new` redirects to `/submit` as of 4b).
- `requireMember()` from `@/lib/viewer`. `slugify`/`uniqueSlug` from `@/lib/slug`. `getWriteClient`/`client` reader. Server-action test mocks per `recipe-actions.test.ts` / `publish-actions.test.ts`.
- Branch `design/app-overhaul-spec`; do NOT push/branch.

---

## File Structure

**Create:**
- `src/lib/import/recipe-to-blurb.ts` (+ `.test.ts`) — `recipeToBlurb(recipe)` (pure).
- `src/components/recipe-edit-form.tsx` (+ `.test.tsx`) — trimmed text-only edit form + "Re-import" link.

**Modify:**
- `src/app/actions/publish-actions.ts` (+ `.test.ts`) — `publishRecipe(draft, opts?)` republish-over-id.
- `src/app/actions/recipe-actions.ts` (+ `.test.ts`) — add `editRecipeText`; delete `saveRecipe`; clean `deleteRecipe`'s dead `mealPlan` patch.
- `src/components/import-review.tsx` (+ `.test.tsx`) — accept `initialBlurb?` + `recipeId?`; pass `recipeId` to `publishRecipe`.
- `src/app/(site)/recipe/[slug]/edit/page.tsx` — render `RecipeEditForm` (drop `RecipeForm` + `INGREDIENTS_QUERY`).
- `src/app/(site)/submit/page.tsx` — handle `?reimport=<id>`: fetch recipe → `recipeToBlurb` → pass `initialBlurb` + `recipeId` to `ImportReview`.

**Delete:**
- `src/components/recipe-form.tsx`.

---

## Task 1: `publishRecipe` republish-over-id + `recipeToBlurb`

**Files:**
- Create: `src/lib/import/recipe-to-blurb.ts`, `src/lib/import/recipe-to-blurb.test.ts`
- Modify: `src/app/actions/publish-actions.ts`, `src/app/actions/publish-actions.test.ts`

- [ ] **Step 1: Write the `recipeToBlurb` test** — create `src/lib/import/recipe-to-blurb.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { recipeToBlurb } from "@/lib/import/recipe-to-blurb";

describe("recipeToBlurb", () => {
  it("renders title, servings, ingredients (with optional), and numbered steps", () => {
    const blurb = recipeToBlurb({
      title: "Chili",
      description: "A pot of chili.",
      servings: 4,
      ingredients: [
        { quantity: "1", unit: "lb", name: "ground beef", optional: false },
        { quantity: "2", unit: "tbsp", name: "cilantro", optional: true },
      ],
      steps: ["Brown the beef.", "Simmer."],
    });
    expect(blurb).toContain("Chili");
    expect(blurb).toContain("Serves 4");
    expect(blurb).toMatch(/1 lb ground beef/);
    expect(blurb).toMatch(/cilantro \(optional\)/);
    expect(blurb).toMatch(/1\. Brown the beef\./);
    expect(blurb).toMatch(/2\. Simmer\./);
  });

  it("tolerates missing fields", () => {
    const blurb = recipeToBlurb({ title: "Toast", ingredients: null, steps: null });
    expect(blurb).toContain("Toast");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/import/recipe-to-blurb.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement** — create `src/lib/import/recipe-to-blurb.ts`:

```ts
type BlurbIngredient = {
  quantity?: string | null;
  unit?: string | null;
  name?: string | null;
  optional?: boolean | null;
};
type BlurbRecipe = {
  title: string;
  description?: string | null;
  servings?: number | null;
  ingredients?: BlurbIngredient[] | null;
  steps?: string[] | null;
};

/** Render an existing recipe back into an editable plain-text blurb for re-import. */
export function recipeToBlurb(recipe: BlurbRecipe): string {
  const lines: string[] = [recipe.title];
  if (recipe.description) lines.push("", recipe.description);
  if (recipe.servings) lines.push("", `Serves ${recipe.servings}`);

  lines.push("", "Ingredients:");
  for (const ing of recipe.ingredients ?? []) {
    const amount = [ing.quantity, ing.unit, ing.name].filter(Boolean).join(" ").trim();
    if (!amount) continue;
    lines.push(`- ${amount}${ing.optional ? " (optional)" : ""}`);
  }

  lines.push("", "Steps:");
  (recipe.steps ?? []).forEach((s, i) => lines.push(`${i + 1}. ${s}`));

  return lines.join("\n");
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/import/recipe-to-blurb.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the republish test** — append to `src/app/actions/publish-actions.test.ts`, inside the `describe("publishRecipe", ...)` block (the `patch` mock is already set up at the top of the file via `getWriteClient`):

```ts
  it("republishes over an existing recipe id (patch, keeps slug, no cover regen)", async () => {
    // republish path: fetch existing {_type, slug} then patch
    sanityFetch
      .mockResolvedValueOnce(["dinner-id"]) // tag ids
      .mockResolvedValueOnce({ _type: "recipe", slug: "weeknight-chili" }); // existing doc
    const res = await publishRecipe(DRAFT, { recipeId: "rec-1" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.slug).toBe("weeknight-chili");
    expect(create).not.toHaveBeenCalled(); // patched, not created
    expect(generateRecipeCover).not.toHaveBeenCalled(); // keep existing cover
  });

  it("errors when the republish target is not a recipe", async () => {
    sanityFetch
      .mockResolvedValueOnce([]) // tags
      .mockResolvedValueOnce(null); // no such recipe
    const res = await publishRecipe(DRAFT, { recipeId: "ghost" });
    expect(res.ok).toBe(false);
  });
```

> The existing `patch` mock in this test file is `vi.fn(() => ({ set: () => ({ commit: ... }) }))`. If the republish assertions need to inspect the patched doc, that mock already returns a chainable `set().commit()`. Ensure the top-of-file `getWriteClient` mock exposes BOTH `create` and `patch` (it does per 4b). If `patch` isn't captured, add `const patch = vi.fn(() => ({ set: vi.fn(() => ({ commit: vi.fn().mockResolvedValue({}) })) }));` and include it in the mocked client.

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/app/actions/publish-actions.test.ts`
Expected: FAIL — `publishRecipe` doesn't accept `opts`/republish yet.

- [ ] **Step 7: Implement the republish path** — in `src/app/actions/publish-actions.ts`, change the signature and branch on `recipeId`. Replace the slug/create tail (from `const taken = ...` through `return { ok: true, slug };`) with:

```ts
  // Republish over an existing recipe (re-import): patch in place, keep slug +
  // images, don't regenerate the cover.
  if (opts?.recipeId) {
    const existing = await reader().fetch<{ _type: string; slug: string | null } | null>(
      `*[_id == $id][0]{ _type, "slug": slug.current }`,
      { id: opts.recipeId },
    );
    if (!existing || existing._type !== "recipe" || !existing.slug) {
      return { ok: false, error: "Recipe not found" };
    }
    await write
      .patch(opts.recipeId)
      .set({
        title,
        description: draft.description.trim() || undefined,
        story: draft.story?.trim() || undefined,
        prepTime: draft.prepTime,
        cookTime: draft.cookTime,
        servings: draft.servings,
        steps: draft.steps.map((s) => s.trim()).filter(Boolean),
        ingredients,
        tags: tagIds.map((id, i) => ({ _type: "reference", _key: `tag-${i}`, _ref: id })),
        macros: {
          base: macros.base,
          full: macros.full,
          estimated: true,
          computedAt: new Date().toISOString(),
          unparsedLines: macros.unparsedLines,
        },
      })
      .commit();
    revalidatePath("/", "layout");
    revalidatePath(`/recipe/${existing.slug}`);
    return { ok: true, slug: existing.slug };
  }

  const taken = await reader().fetch<string[]>(
    `*[_type == "recipe" && defined(slug.current)].slug.current`,
  );
  const slug = uniqueSlug(slugify(title) || "recipe", taken);

  const created = await write.create({
    _type: "recipe",
    title,
    slug: { _type: "slug", current: slug },
    description: draft.description.trim() || undefined,
    story: draft.story?.trim() || undefined,
    prepTime: draft.prepTime,
    cookTime: draft.cookTime,
    servings: draft.servings,
    steps: draft.steps.map((s) => s.trim()).filter(Boolean),
    ingredients,
    tags: tagIds.map((id, i) => ({ _type: "reference", _key: `tag-${i}`, _ref: id })),
    macros: {
      base: macros.base,
      full: macros.full,
      estimated: true,
      computedAt: new Date().toISOString(),
      unparsedLines: macros.unparsedLines,
    },
  });

  await generateRecipeCover(created._id, title);

  revalidatePath("/", "layout");
  revalidatePath(`/recipe/${slug}`);
  return { ok: true, slug };
```

And change the function signature line to:

```ts
export async function publishRecipe(
  draft: RecipeDraft,
  opts?: { recipeId?: string },
): Promise<PublishResult> {
```

(The `title`/`ingredients`/`tagIds`/`macros` computation above this block is unchanged from 4b.)

- [ ] **Step 8: Run to verify it passes + commit**

Run: `npx vitest run src/app/actions/publish-actions.test.ts src/lib/import/recipe-to-blurb.test.ts && npx tsc --noEmit`
Expected: PASS, clean.

```bash
git add src/app/actions/publish-actions.ts src/app/actions/publish-actions.test.ts src/lib/import/recipe-to-blurb.ts src/lib/import/recipe-to-blurb.test.ts
git commit -m "feat(4c): publishRecipe republish-over-id + recipeToBlurb"
```

---

## Task 2: `editRecipeText` + retire `saveRecipe`

**Files:**
- Modify: `src/app/actions/recipe-actions.ts`, `src/app/actions/recipe-actions.test.ts`

- [ ] **Step 1: Rewrite the saveRecipe tests as editRecipeText tests.** In `src/app/actions/recipe-actions.test.ts`: change the import from `{ saveRecipe, deleteRecipe }` to `{ editRecipeText, deleteRecipe }`; replace the `saveRecipe`-specific tests with:

```ts
  it("editRecipeText requires a title", async () => {
    const res = await editRecipeText("r1", new FormData());
    expect(res).toEqual({ ok: false, error: "Title is required" });
  });

  it("editRecipeText propagates the authorization error for non-members", async () => {
    mockRequireMember.mockRejectedValue(new Error("Not authorized: household members only"));
    const fd = new FormData();
    fd.set("title", "X");
    await expect(editRecipeText("r1", fd)).rejects.toThrow("Not authorized");
    await expect(deleteRecipe("r1")).rejects.toThrow("Not authorized");
  });
```

Keep the existing `deleteRecipe` "refuses a non-recipe target" test. Remove any test that referenced `saveRecipe` ingredient creation / the `getOrCreateEnrichedIngredient` mock if it's no longer used (leave the mock only if `deleteRecipe`/`editRecipeText` need it — they don't, so remove that `vi.mock("@/lib/ingredients/get-or-create", ...)` line if present).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/app/actions/recipe-actions.test.ts`
Expected: FAIL — `editRecipeText` not exported.

- [ ] **Step 3: Implement `editRecipeText` + delete `saveRecipe` + clean `deleteRecipe`.** In `src/app/actions/recipe-actions.ts`:

Delete the entire `saveRecipe` function and its `SaveRecipeResult` type's create-path usage (keep a result type for `editRecipeText`). Remove the now-unused imports (`getOrCreateEnrichedIngredient`, `slugify`/`uniqueSlug` if only `saveRecipe` used them, `downscaleImage` is in the form not here). Add:

```ts
export type EditRecipeResult = { ok: true; slug: string } | { ok: false; error: string };

/**
 * Light text-only edit: title, headnote, times, servings, steps, tags. Does NOT
 * touch ingredients/macros/images — ingredient changes go through Re-import.
 */
export async function editRecipeText(
  recipeId: string,
  formData: FormData,
): Promise<EditRecipeResult> {
  await requireMember();
  await assertRecipe(recipeId);

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "Title is required" };

  const description = String(formData.get("description") ?? "").trim() || undefined;
  const story = String(formData.get("story") ?? "").trim() || undefined;
  const prepTime = Number(formData.get("prepTime")) || undefined;
  const cookTime = Number(formData.get("cookTime")) || undefined;
  const servings = Number(formData.get("servings")) || undefined;
  const steps = formData.getAll("step").map((s) => String(s).trim()).filter(Boolean);

  const submittedTagIds = formData.getAll("tag").map((t) => String(t));
  const tagIds = submittedTagIds.length
    ? await reader().fetch<string[]>(`*[_type == "tag" && _id in $ids]._id`, {
        ids: submittedTagIds,
      })
    : [];

  const write = getWriteClient();
  await write
    .patch(recipeId)
    .set({
      title,
      description,
      story,
      prepTime,
      cookTime,
      servings,
      steps,
      tags: tagIds.map((id, i) => ({ _type: "reference", _key: `tag-${i}`, _ref: id })),
    })
    .commit();

  const slug = await reader().fetch<string | null>(`*[_id == $id][0].slug.current`, {
    id: recipeId,
  });
  if (!slug) return { ok: false, error: "Recipe not found" };

  revalidatePath("/", "layout");
  revalidatePath(`/recipe/${slug}`);
  return { ok: true, slug };
}
```

Also clean `deleteRecipe`: remove the dead `write.patch(PLAN_ID).unset(...)` block (the `mealPlan` doc no longer exists) and the now-unused `PLAN_ID` constant. `deleteRecipe` keeps: `requireMember` → `assertRecipe` → `safeRecipeId` → `write.delete(id)` → `revalidatePath`. Confirm `safeRecipeId` is still used (by deleteRecipe) — keep it; if it becomes unused after the cleanup, remove it too.

- [ ] **Step 4: Run + typecheck**

Run: `npx vitest run src/app/actions/recipe-actions.test.ts && npx tsc --noEmit`
Expected: PASS — but `tsc` WILL error in `recipe-form.tsx` (still imports the deleted `saveRecipe`) and the edit page (renders `RecipeForm`). Those are fixed/deleted in Task 3. Confirm the ONLY tsc errors are in `recipe-form.tsx` + `recipe/[slug]/edit/page.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/recipe-actions.ts src/app/actions/recipe-actions.test.ts
git commit -m "feat(4c): editRecipeText (text-only); retire saveRecipe; drop dead mealPlan patch"
```

---

## Task 3: `RecipeEditForm` + wire the edit page; delete `recipe-form.tsx`

**Files:**
- Create: `src/components/recipe-edit-form.tsx`, `src/components/recipe-edit-form.test.tsx`
- Modify: `src/app/(site)/recipe/[slug]/edit/page.tsx`
- Delete: `src/components/recipe-form.tsx`

- [ ] **Step 1: Implement `RecipeEditForm`** — create `src/components/recipe-edit-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RecipeEditData, TagOption } from "@/sanity/types";
import { editRecipeText } from "@/app/actions/recipe-actions";

export function RecipeEditForm({
  recipe,
  tags,
}: {
  recipe: RecipeEditData;
  tags: TagOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<string[]>(recipe.steps?.length ? recipe.steps : [""]);
  const [tagIds, setTagIds] = useState<string[]>(recipe.tagIds ?? []);
  const [pending, start] = useTransition();

  const toggleTag = (id: string) =>
    setTagIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const onSubmit = (formData: FormData) => {
    setError(null);
    for (const s of steps) if (s.trim()) formData.append("step", s.trim());
    for (const id of tagIds) formData.append("tag", id);
    start(async () => {
      const res = await editRecipeText(recipe._id, formData);
      if (res.ok) router.push(`/recipe/${res.slug}`);
      else setError(res.error);
    });
  };

  return (
    <form action={onSubmit} className="space-y-6" aria-busy={pending}>
      {error ? <p role="alert" className="text-sm text-terracotta-deep">{error}</p> : null}

      <label className="block">
        <span className="kicker text-ink-soft">Title</span>
        <input name="title" defaultValue={recipe.title} className="mt-1 w-full border-b border-ink/25 bg-transparent pb-1 text-2xl text-ink focus:border-terracotta" />
      </label>
      <label className="block">
        <span className="kicker text-ink-soft">Headnote</span>
        <textarea name="description" defaultValue={recipe.description ?? ""} rows={3} className="mt-1 w-full border border-ink/20 bg-transparent p-2 text-ink focus:border-terracotta" />
      </label>
      <label className="block">
        <span className="kicker text-ink-soft">Story (optional)</span>
        <textarea name="story" defaultValue={recipe.story ?? ""} rows={3} className="mt-1 w-full border border-ink/20 bg-transparent p-2 text-ink focus:border-terracotta" />
      </label>

      <div className="flex gap-4">
        <label className="flex-1"><span className="kicker text-ink-soft">Prep (min)</span>
          <input name="prepTime" type="number" min={0} defaultValue={recipe.prepTime ?? ""} className="mt-1 w-full border-b border-ink/25 bg-transparent pb-1 text-ink" /></label>
        <label className="flex-1"><span className="kicker text-ink-soft">Cook (min)</span>
          <input name="cookTime" type="number" min={0} defaultValue={recipe.cookTime ?? ""} className="mt-1 w-full border-b border-ink/25 bg-transparent pb-1 text-ink" /></label>
        <label className="flex-1"><span className="kicker text-ink-soft">Servings</span>
          <input name="servings" type="number" min={0} defaultValue={recipe.servings ?? ""} className="mt-1 w-full border-b border-ink/25 bg-transparent pb-1 text-ink" /></label>
      </div>

      <section aria-labelledby="steps-heading">
        <h2 id="steps-heading" className="kicker text-terracotta">Steps</h2>
        <ol className="mt-2 space-y-2">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-2">
              <textarea
                value={s}
                onChange={(e) => setSteps((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))}
                aria-label={`Step ${i + 1}`}
                rows={2}
                className="flex-1 border border-ink/20 bg-transparent p-2 text-ink focus:border-terracotta"
              />
              <button type="button" onClick={() => setSteps((xs) => xs.filter((_, j) => j !== i))} aria-label={`Remove step ${i + 1}`} className="kicker text-ink-soft hover:text-terracotta">Remove</button>
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => setSteps((xs) => [...xs, ""])} className="kicker mt-2 text-terracotta hover:text-terracotta-deep">+ Add step</button>
      </section>

      <section aria-labelledby="tags-heading">
        <h2 id="tags-heading" className="kicker text-terracotta">Tags</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.map((t) => {
            const active = tagIds.includes(t._id);
            return (
              <button key={t._id} type="button" aria-pressed={active} onClick={() => toggleTag(t._id)} className={`kicker border px-2 py-1 ${active ? "border-terracotta bg-terracotta-wash text-terracotta" : "border-ink/20 text-ink-soft hover:border-terracotta"}`}>
                {t.name}
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex items-center gap-4 border-t border-terracotta/25 pt-4">
        <button type="submit" disabled={pending} className="kicker rounded-full bg-terracotta px-5 py-2 text-paper hover:bg-terracotta-deep disabled:opacity-40">
          {pending ? "Saving…" : "Save changes"}
        </button>
        <Link href={`/submit?reimport=${recipe._id}`} className="kicker text-ink-soft hover:text-terracotta">
          Re-import ingredients
        </Link>
      </div>
      <p className="text-sm text-ink-soft">
        Editing ingredients re-runs normalization. Use Re-import to change the
        ingredient list, quantities, or macros.
      </p>
    </form>
  );
}
```

- [ ] **Step 2: Write behavior tests** — create `src/components/recipe-edit-form.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const editRecipeText = vi.fn();
vi.mock("@/app/actions/recipe-actions", () => ({ editRecipeText: (...a: unknown[]) => editRecipeText(...a) }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { RecipeEditForm } from "@/components/recipe-edit-form";
import type { RecipeEditData } from "@/sanity/types";

const RECIPE: RecipeEditData = {
  _id: "rec-1", title: "Chili", slug: "chili", description: "Hot.",
  prepTime: 10, cookTime: 30, servings: 4,
  ingredients: [{ _key: "k", quantity: "1", unit: "lb", name: "beef", ingredientId: "beef-id", optional: false }],
  steps: ["Brown.", "Simmer."], tagIds: ["t1"], hasImage: true,
};
const TAGS = [{ _id: "t1", name: "dinner" }, { _id: "t2", name: "spicy" }];

beforeEach(() => {
  editRecipeText.mockReset().mockResolvedValue({ ok: true, slug: "chili" });
  push.mockReset();
});

describe("RecipeEditForm", () => {
  it("renders the text fields and a Re-import link (no ingredient editing)", () => {
    render(<RecipeEditForm recipe={RECIPE} tags={TAGS} />);
    expect(screen.getByDisplayValue("Chili")).toBeInTheDocument();
    expect(screen.getByLabelText("Step 1")).toHaveValue("Brown.");
    expect(screen.getByRole("link", { name: /Re-import/ })).toHaveAttribute("href", "/submit?reimport=rec-1");
    // no ingredient quantity inputs
    expect(screen.queryByLabelText(/Quantity for/)).not.toBeInTheDocument();
  });

  it("saves text edits via editRecipeText and routes to the recipe", async () => {
    const user = userEvent.setup();
    render(<RecipeEditForm recipe={RECIPE} tags={TAGS} />);
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(editRecipeText).toHaveBeenCalledWith("rec-1", expect.any(FormData));
    expect(push).toHaveBeenCalledWith("/recipe/chili");
  });
});
```

- [ ] **Step 3: Wire the edit page + delete `recipe-form.tsx`.** Replace `src/app/(site)/recipe/[slug]/edit/page.tsx` with:

```tsx
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { client } from "@/sanity/lib/client";
import { RECIPE_EDIT_QUERY, TAGS_QUERY } from "@/sanity/lib/queries";
import type { RecipeEditData, TagOption } from "@/sanity/types";
import { RecipeEditForm } from "@/components/recipe-edit-form";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer.isAuthenticated) redirect("/");
  if (!viewer.isMember) redirect("/household/setup");
  const { slug } = await params;
  const [recipe, tags] = await Promise.all([
    client.withConfig({ useCdn: false }).fetch<RecipeEditData | null>(RECIPE_EDIT_QUERY, { slug }),
    client.fetch<TagOption[]>(TAGS_QUERY),
  ]);
  if (!recipe) notFound();
  return (
    <section className="mx-auto max-w-2xl">
      <h1 className="editorial-display text-4xl text-ink">Edit recipe</h1>
      <div className="mt-6">
        <RecipeEditForm recipe={recipe} tags={tags} />
      </div>
    </section>
  );
}
```

Then delete the old form:

```bash
git rm src/components/recipe-form.tsx
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run src/components/recipe-edit-form.test.tsx && npx tsc --noEmit`
Expected: PASS, clean (the `recipe-form.tsx`/`saveRecipe` tsc errors from Task 2 are now resolved). If `npm run lint` flags an unused `INGREDIENTS_QUERY`/`IngredientOption` import anywhere, remove it.

- [ ] **Step 5: Commit**

```bash
git add src/components/recipe-edit-form.tsx src/components/recipe-edit-form.test.tsx "src/app/(site)/recipe/[slug]/edit/page.tsx"
git commit -m "feat(4c): RecipeEditForm (text-only edit + Re-import link); delete recipe-form"
```

---

## Task 4: `/submit?reimport` re-import flow + full gate

**Files:**
- Modify: `src/components/import-review.tsx`, `src/components/import-review.test.tsx`, `src/app/(site)/submit/page.tsx`

- [ ] **Step 1: Extend `ImportReview` to accept `initialBlurb` + `recipeId`.** In `src/components/import-review.tsx`:

Change the props + the `blurb` initial state + the `publish` call:

```tsx
export function ImportReview({
  tags,
  initialBlurb = "",
  recipeId,
}: {
  tags: TagOption[];
  initialBlurb?: string;
  recipeId?: string;
}) {
```

Change `const [blurb, setBlurb] = useState("");` to `const [blurb, setBlurb] = useState(initialBlurb);`.

Change the `publish` action call from `await publishRecipe(draft)` to:

```ts
      const res = await publishRecipe(draft, recipeId ? { recipeId } : undefined);
```

- [ ] **Step 2: Add a re-import test** — append to `src/components/import-review.test.tsx`:

```tsx
  it("prefills the blurb and republishes the same id when re-importing", async () => {
    const user = userEvent.setup();
    actions.importRecipe.mockResolvedValue({ ok: true, draft: DRAFT });
    render(<ImportReview tags={TAGS} initialBlurb="Existing recipe text" recipeId="rec-1" />);
    expect(screen.getByLabelText("Recipe text")).toHaveValue("Existing recipe text");
    await user.click(screen.getByRole("button", { name: "Generate draft" }));
    await screen.findByDisplayValue("Chili");
    await user.click(screen.getByRole("button", { name: "Publish recipe" }));
    expect(actions.publishRecipe).toHaveBeenCalledWith(expect.anything(), { recipeId: "rec-1" });
  });
```

(Confirm the existing publish test still passes — when no `recipeId`, `publishRecipe` is called with `(draft, undefined)`; if that existing assertion was `toHaveBeenCalledWith(DRAFT)` with one arg, relax it to `expect(actions.publishRecipe).toHaveBeenCalled()` so the new optional second arg doesn't fail it.)

- [ ] **Step 3: Handle `?reimport` on the submit page.** Replace `src/app/(site)/submit/page.tsx` with:

```tsx
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { client } from "@/sanity/lib/client";
import { TAGS_QUERY, RECIPE_EDIT_QUERY } from "@/sanity/lib/queries";
import type { TagOption, RecipeEditData } from "@/sanity/types";
import { recipeToBlurb } from "@/lib/import/recipe-to-blurb";
import { ImportReview } from "@/components/import-review";

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ reimport?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer.isAuthenticated) redirect("/");
  if (!viewer.isMember) redirect("/household/setup");

  const { reimport } = await searchParams;
  const tags = await client.fetch<TagOption[]>(TAGS_QUERY);

  let initialBlurb = "";
  let recipeId: string | undefined;
  if (reimport) {
    const recipe = await client
      .withConfig({ useCdn: false })
      .fetch<RecipeEditData | null>(`*[_type == "recipe" && _id == $id][0]{ _id, title, description, servings, "ingredients": ingredients[]{ quantity, unit, optional, "name": ingredient->name }, steps }`, { id: reimport });
    if (recipe) {
      initialBlurb = recipeToBlurb(recipe);
      recipeId = recipe._id;
    }
  }

  return (
    <section className="mx-auto max-w-2xl">
      <header className="set set-1">
        <p className="kicker text-terracotta">{recipeId ? "Re-import recipe" : "Add a recipe"}</p>
        <h1 className="editorial-display mt-2 text-4xl text-ink md:text-5xl">{recipeId ? "Re-import" : "Submit"}</h1>
        <p className="editorial-aside mt-3 text-ink-soft">
          Paste a recipe and June&rsquo;s kitchen will normalize it: ingredients,
          steps, macros, and a cover.
        </p>
        <div className="rule-draw mt-5 h-px w-full bg-terracotta/40" />
      </header>
      <ImportReview tags={tags} initialBlurb={initialBlurb} recipeId={recipeId} />
    </section>
  );
}
```

> Note: the inline GROQ for re-import returns a partial `RecipeEditData` (only the fields `recipeToBlurb` reads). The `as`-free `fetch<RecipeEditData | null>` is acceptable since `recipeToBlurb`'s param type is structural; if `tsc` complains about missing required `RecipeEditData` fields, type the fetch as `RecipeEditData | null` is too strict — instead type it inline: `fetch<{ _id: string; title: string; description?: string; servings?: number; ingredients?: {quantity?:string;unit?:string;optional?:boolean;name?:string|null}[]|null; steps?: string[]|null } | null>(...)`. Use that inline type if needed.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/components/import-review.test.tsx`
Expected: PASS (existing + the new re-import test).

- [ ] **Step 5: Full gate**

Run: `npx vitest run && npm run lint && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 6: Convex smoke check.** Run: `npx convex dev --once` — clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/import-review.tsx src/components/import-review.test.tsx "src/app/(site)/submit/page.tsx"
git commit -m "feat(4c): /submit?reimport prefill + republish same id"
```

---

## Post-implementation gate (whole sub-plan)

- [ ] Full gate green: `npx vitest run` + `npm run lint` + `npx tsc --noEmit` + `npx convex dev --once`.
- [ ] Holistic review across the 4c commits; address findings.
- [ ] Confirm: editing a recipe shows the text-only form (no ingredient editing) + a Re-import link; saving text edits routes back to the recipe; "Re-import" opens `/submit` prefilled, and publishing republishes the SAME recipe id (slug + ratings/made/notes preserved); `recipe-form.tsx`/`saveRecipe` are gone; the import pipeline is the only path that writes ingredients.

---

## Self-review notes (coverage vs Spec 4 design §6, §9)

- §6 light text edit (`editRecipeText`) + trimmed form → Tasks 2, 3.
- §6 Re-import (re-run pipeline → republish same id, keep slug/ratings/notes) → Tasks 1, 3, 4.
- §9 retire `recipe-form` create + ingredient path; `saveRecipe` → `editRecipeText`; one create path (the pipeline) → Tasks 2, 3.
- Cleanup: `deleteRecipe`'s dead `mealPlan` patch removed → Task 2.
- Out of scope: manual cover upload (covers auto-generate / persist on re-import); steps editing exists in the edit form but not the import-review draft (drafts publish steps as-generated; the edit form edits them) — acceptable.
