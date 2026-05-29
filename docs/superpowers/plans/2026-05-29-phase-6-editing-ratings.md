# Cooking with June — Phase 6: In-app Editing & Ratings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development or executing-plans. Checkbox steps; TDD where marked.

**Goal:** Let signed-in editors do everyday actions in-app — rate a recipe (their own per-editor stars), mark "made it", toggle the to-try wishlist — and create/edit recipes via a simple in-app form (cover photo, text, times, servings, tags, ingredient lines, steps). All writes go through Next.js **server actions** using a secret Sanity **write token**, gated by `requireEditor()`. Studio remains for heavy editing.

**Architecture:** A server-only write client (lazy — only needs the token at call time, so builds don't require it). Server actions in `src/app/actions/recipe-actions.ts` (`"use server"`) each call `requireEditor()` first, mutate Sanity, then `revalidatePath`. Pure transforms (`upsertRating`, `slugify`) are isolated + unit-tested. Editor-only UI: a client `EditorActions` island on the recipe detail page (interactive stars + made-it + wishlist), and `RecipeForm` on gated `/recipe/new` and `/recipe/[slug]/edit` pages.

**Tech Stack:** Next.js 16 server actions, next-sanity write client, Vitest.

**Design:** `design.md` — interactive stars in ochre, actions as quiet kicker buttons / clay for the "made it" stamp, editorial form (hairline-underline inputs, kicker labels). No emoji (PawMark allowed).

## MANUAL SETUP (user)
`.env.local` must include the **write token** (from project creation; secret, server-only):
```
SANITY_API_WRITE_TOKEN=<the writeToken>
```
Writes (rating/made-it/wishlist/save) fail without it; reads/build/tests do not need it.

## Conventions
- App code uses `@/`. Don't touch `src/sanity/env.ts`, `sanity.config.ts`, `sanity.cli.ts`, `.env*`.
- Recipe writes create **published** documents (JS client `create()`), so they appear on the public site.

## File Structure
Created:
- `src/sanity/lib/write-client.ts` — lazy server-only write client
- `src/lib/rating-mutate.ts` + `.test.ts` — `upsertRating()` (TDD)
- `src/lib/slug.ts` + `.test.ts` — `slugify()` (TDD)
- `src/app/actions/recipe-actions.ts` — `"use server"` actions (rate / made / wishlist / save)
- `src/components/editor-actions.tsx` — client island (detail page): stars + made-it + wishlist
- `src/components/recipe-form.tsx` — client add/edit form
- `src/app/(site)/recipe/new/page.tsx` — gated create page
- `src/app/(site)/recipe/[slug]/edit/page.tsx` — gated edit page
Modified:
- `src/app/(site)/recipe/[slug]/page.tsx` — render `<EditorActions/>` for editors; add an "Edit" link for editors
- `src/sanity/lib/queries.ts` — add `RECIPE_EDIT_QUERY` (raw fields incl. ingredient _refs for the edit form) + `INGREDIENTS_QUERY`/`TAGS_QUERY` already exist

---

## Task 1: Write client (lazy, server-only)
- [ ] **Step 1: `src/sanity/lib/write-client.ts`**
```ts
import { createClient } from "next-sanity";
import { apiVersion, dataset, projectId } from "@/sanity/env";

// Server-only. Lazy so the build doesn't require the token at import time.
export function getWriteClient() {
  const token = process.env.SANITY_API_WRITE_TOKEN;
  if (!token) {
    throw new Error("Missing SANITY_API_WRITE_TOKEN");
  }
  return createClient({
    projectId,
    dataset,
    apiVersion,
    token,
    useCdn: false,
  });
}
```
- [ ] **Step 2:** `npx tsc --noEmit`. Commit: `git add src/sanity/lib/write-client.ts && git commit -m "feat: lazy server-only Sanity write client"`

---

## Task 2: upsertRating (TDD)
One rating per editor; key derived from editorId so re-rating replaces, never duplicates.
- [ ] **Step 1: Test `src/lib/rating-mutate.test.ts`**
```ts
import { describe, it, expect } from "vitest";
import { upsertRating, ratingKey, type StoredRating } from "@/lib/rating-mutate";

describe("upsertRating", () => {
  it("appends a new rating for a new editor", () => {
    const out = upsertRating([], "e1", 4.5);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      _key: ratingKey("e1"),
      _type: "rating",
      editor: { _type: "reference", _ref: "e1" },
      value: 4.5,
    });
  });
  it("replaces the same editor's rating without duplicating", () => {
    const existing: StoredRating[] = [
      { _key: ratingKey("e1"), _type: "rating", editor: { _type: "reference", _ref: "e1" }, value: 3 },
      { _key: ratingKey("e2"), _type: "rating", editor: { _type: "reference", _ref: "e2" }, value: 5 },
    ];
    const out = upsertRating(existing, "e1", 4);
    expect(out).toHaveLength(2);
    expect(out.find((r) => r.editor._ref === "e1")?.value).toBe(4);
    expect(out.find((r) => r.editor._ref === "e2")?.value).toBe(5);
  });
});
```
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3: Implement `src/lib/rating-mutate.ts`**
```ts
export type StoredRating = {
  _key: string;
  _type: "rating";
  editor: { _type: "reference"; _ref: string };
  value: number;
};

export function ratingKey(editorId: string): string {
  return `rating-${editorId}`;
}

export function upsertRating(
  ratings: StoredRating[],
  editorId: string,
  value: number,
): StoredRating[] {
  const key = ratingKey(editorId);
  const next: StoredRating = {
    _key: key,
    _type: "rating",
    editor: { _type: "reference", _ref: editorId },
    value,
  };
  const exists = ratings.some((r) => r._key === key);
  return exists
    ? ratings.map((r) => (r._key === key ? next : r))
    : [...ratings, next];
}
```
- [ ] **Step 4:** Run — PASS. Commit: `git add src/lib/rating-mutate.ts src/lib/rating-mutate.test.ts && git commit -m "feat: upsertRating transform"`

---

## Task 3: slugify (TDD)
- [ ] **Step 1: Test `src/lib/slug.test.ts`**
```ts
import { describe, it, expect } from "vitest";
import { slugify } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases, trims, and hyphenates", () => {
    expect(slugify("Weeknight Beef Ragù")).toBe("weeknight-beef-ragu");
    expect(slugify("  Garlic   Butter Spaghetti! ")).toBe("garlic-butter-spaghetti");
    expect(slugify("Mac & Cheese")).toBe("mac-cheese");
  });
  it("returns empty string for empty input", () => {
    expect(slugify("")).toBe("");
    expect(slugify("   ")).toBe("");
  });
});
```
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: `src/lib/slug.ts`**
```ts
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```
- [ ] **Step 4:** PASS. Commit: `git add src/lib/slug.ts src/lib/slug.test.ts && git commit -m "feat: slugify helper"`

---

## Task 4: Add edit query
- [ ] **Step 1:** In `src/sanity/lib/queries.ts` add:
```ts
export const RECIPE_EDIT_QUERY = defineQuery(`
  *[_type == "recipe" && slug.current == $slug][0]{
    _id,
    title,
    "slug": slug.current,
    description,
    story,
    prepTime,
    cookTime,
    servings,
    "ingredients": ingredients[]{ _key, quantity, unit, note, "ingredientId": ingredient._ref, "name": ingredient->name },
    steps,
    "tagIds": tags[]._ref,
    "hasImage": defined(images[0])
  }
`);
```
- [ ] **Step 2:** Add a matching `RecipeEditData` type to `src/sanity/types.ts`:
```ts
export type RecipeEditData = {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  story?: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  ingredients:
    | { _key: string; quantity?: string; unit?: string; note?: string; ingredientId: string; name: string | null }[]
    | null;
  steps: string[] | null;
  tagIds: string[] | null;
  hasImage: boolean;
};
```
- [ ] **Step 3:** `npx tsc --noEmit`. Commit: `git add src/sanity && git commit -m "feat: add recipe edit query + type"`

---

## Task 5: Server actions (rate / made-it / wishlist / save)

- [ ] **Step 1: `src/app/actions/recipe-actions.ts`**
```ts
"use server";

import { revalidatePath } from "next/cache";
import { getWriteClient } from "@/sanity/lib/write-client";
import { client } from "@/sanity/lib/client";
import { requireEditor } from "@/lib/viewer";
import { upsertRating, type StoredRating } from "@/lib/rating-mutate";
import { slugify } from "@/lib/slug";

async function resolveIngredientId(
  write: ReturnType<typeof getWriteClient>,
  name: string,
): Promise<string> {
  const clean = name.trim();
  const existing = await client
    .withConfig({ useCdn: false })
    .fetch<{ _id: string } | null>(
      `*[_type == "ingredient" && lower(name) == lower($name)][0]{ _id }`,
      { name: clean },
    );
  if (existing?._id) return existing._id;
  const created = await write.create({ _type: "ingredient", name: clean });
  return created._id;
}

export async function rateRecipe(recipeId: string, value: number) {
  const { editorId } = await requireEditor();
  if (value < 0 || value > 5) throw new Error("Rating must be 0–5");
  const write = getWriteClient();
  const current = await client
    .withConfig({ useCdn: false })
    .fetch<StoredRating[] | null>(`*[_id == $id][0].ratings`, { id: recipeId });
  const next = upsertRating(current ?? [], editorId, value);
  await write.patch(recipeId).set({ ratings: next }).commit();
  revalidatePath("/", "layout");
}

export async function toggleWishlist(recipeId: string) {
  await requireEditor();
  const write = getWriteClient();
  const current = await client
    .withConfig({ useCdn: false })
    .fetch<boolean | null>(`*[_id == $id][0].wishlist`, { id: recipeId });
  await write.patch(recipeId).set({ wishlist: !current }).commit();
  revalidatePath("/", "layout");
}

export async function markMade(recipeId: string, isoNow: string) {
  await requireEditor();
  const write = getWriteClient();
  await write
    .patch(recipeId)
    .setIfMissing({ madeCount: 0 })
    .inc({ madeCount: 1 })
    .set({ lastMadeAt: isoNow })
    .commit();
  revalidatePath("/", "layout");
}

export type SaveRecipeResult = { ok: true; slug: string } | { ok: false; error: string };

export async function saveRecipe(
  recipeId: string | null,
  formData: FormData,
): Promise<SaveRecipeResult> {
  await requireEditor();
  const write = getWriteClient();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "Title is required" };

  const description = String(formData.get("description") ?? "").trim() || undefined;
  const story = String(formData.get("story") ?? "").trim() || undefined;
  const prepTime = Number(formData.get("prepTime")) || undefined;
  const cookTime = Number(formData.get("cookTime")) || undefined;
  const servings = Number(formData.get("servings")) || undefined;

  const steps = formData
    .getAll("step")
    .map((s) => String(s).trim())
    .filter(Boolean);

  const tagIds = formData.getAll("tag").map((t) => String(t));

  // ingredient rows: parallel arrays ingName / ingQty / ingUnit
  const names = formData.getAll("ingName").map((n) => String(n).trim());
  const qtys = formData.getAll("ingQty").map((q) => String(q).trim());
  const units = formData.getAll("ingUnit").map((u) => String(u).trim());

  const ingredients: {
    _key: string;
    _type: "ingredientLine";
    ingredient: { _type: "reference"; _ref: string };
    quantity?: string;
    unit?: string;
  }[] = [];
  for (let i = 0; i < names.length; i++) {
    if (!names[i]) continue;
    const id = await resolveIngredientId(write, names[i]);
    ingredients.push({
      _key: `ing-${i}-${id.slice(0, 6)}`,
      _type: "ingredientLine",
      ingredient: { _type: "reference", _ref: id },
      quantity: qtys[i] || undefined,
      unit: units[i] || undefined,
    });
  }

  // optional cover image
  const image = formData.get("image");
  let imageField: unknown = undefined;
  if (image instanceof File && image.size > 0) {
    const asset = await write.assets.upload("image", image, {
      filename: image.name,
    });
    imageField = [
      { _type: "image", _key: "cover", asset: { _type: "reference", _ref: asset._id } },
    ];
  }

  const doc: Record<string, unknown> = {
    _type: "recipe",
    title,
    description,
    story,
    prepTime,
    cookTime,
    servings,
    steps,
    ingredients,
    tags: tagIds.map((id, i) => ({ _type: "reference", _key: `tag-${i}`, _ref: id })),
  };
  if (imageField) doc.images = imageField;

  let slug: string;
  if (recipeId) {
    // edit: patch fields (don't clobber images if none uploaded)
    const patch = write.patch(recipeId).set(doc);
    await patch.commit();
    const existing = await client
      .withConfig({ useCdn: false })
      .fetch<string>(`*[_id == $id][0].slug.current`, { id: recipeId });
    slug = existing;
  } else {
    slug = slugify(title);
    await write.create({
      ...doc,
      slug: { _type: "slug", current: slug },
      wishlist: false,
      madeCount: 0,
    });
  }

  revalidatePath("/", "layout");
  revalidatePath(`/recipe/${slug}`);
  return { ok: true, slug };
}
```
> Note: `revalidatePath("/", "layout")` revalidates the whole site tree (fine for a small app). `markMade` takes the timestamp from the client (event time) to avoid server clock coupling in render. `saveRecipe` on edit sets `doc` (which omits `images` when no new upload), so existing photos are preserved.

- [ ] **Step 2:** `npx tsc --noEmit` clean. Commit: `git add src/app/actions/recipe-actions.ts && git commit -m "feat: editor-gated server actions (rate, made-it, wishlist, save recipe)"`

---

## Task 6: EditorActions island on the recipe detail page

- [ ] **Step 1: `src/components/editor-actions.tsx`**
```tsx
"use client";

import { useState, useTransition } from "react";
import { rateRecipe, toggleWishlist, markMade } from "@/app/actions/recipe-actions";

export function EditorActions({
  recipeId,
  initialMyRating,
  initialWishlist,
}: {
  recipeId: string;
  initialMyRating: number | null;
  initialWishlist: boolean;
}) {
  const [pending, start] = useTransition();
  const [myRating, setMyRating] = useState(initialMyRating ?? 0);
  const [wishlist, setWishlist] = useState(initialWishlist);

  const rate = (v: number) => {
    setMyRating(v);
    start(() => rateRecipe(recipeId, v));
  };

  return (
    <section className="mt-10 border-t border-clay/30 pt-6" aria-label="Editor actions">
      <p className="kicker text-clay">Your kitchen</p>
      <div className="mt-3 flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="kicker text-ink-soft">Your rating</span>
          <div className="flex gap-1" role="group" aria-label="Set your rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                aria-pressed={myRating >= n}
                onClick={() => rate(n)}
                disabled={pending}
                className={`text-2xl leading-none ${myRating >= n ? "text-ochre" : "text-ink/25"} hover:text-ochre`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => markMade(recipeId, new Date().toISOString()))}
          className="kicker border border-clay px-3 py-1 text-clay hover:bg-clay-wash"
        >
          Made it
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setWishlist((w) => !w);
            start(() => toggleWishlist(recipeId));
          }}
          className={`kicker border px-3 py-1 ${wishlist ? "border-heather bg-heather-wash text-heather" : "border-ink/25 text-ink-soft hover:border-heather"}`}
        >
          {wishlist ? "On the to-try list" : "Add to to-try"}
        </button>
      </div>
    </section>
  );
}
```
> The `★` glyph here is a typographic character in an interactive control, not an emoji icon — acceptable. (If preferred, swap for the `StarRating` SVG later.)

- [ ] **Step 2: Edit `src/app/(site)/recipe/[slug]/page.tsx`** — read the viewer, compute the editor's own rating, render `EditorActions` and an Edit link when an editor:
  - Add imports: `import { getViewer } from "@/lib/viewer";` and `import { EditorActions } from "@/components/editor-actions";` and `import Link from "next/link";`
  - In the component, after fetching `recipe`, add: `const viewer = await getViewer();` and
    `const myRating = viewer.editorId ? (recipe.ratings?.find((r) => r._key === \`rating-${viewer.editorId}\`)?.value ?? null) : null;`
    (Note: this requires `ratings[]._key` — `RECIPE_QUERY` already selects `_key` on ratings.)
  - Render, just below the title header block, when `viewer.isEditor`:
    ```tsx
    {viewer.isEditor ? (
      <div className="mt-2">
        <Link href={`/recipe/${recipe.slug}/edit`} className="kicker text-heather hover:text-heather-deep">
          Edit recipe
        </Link>
      </div>
    ) : null}
    ```
  - Render near the bottom (after ratings section) when `viewer.isEditor`:
    ```tsx
    {viewer.isEditor ? (
      <EditorActions
        recipeId={recipe._id}
        initialMyRating={myRating}
        initialWishlist={Boolean(recipe.wishlist)}
      />
    ) : null}
    ```
  - **Important:** calling `getViewer()` (which calls `auth()`) makes this page dynamic. That's acceptable for the recipe detail page. Remove `export const revalidate = 60` from THIS page if present, OR keep it — dynamic wins; to be explicit, change the detail page to `export const dynamic = "force-dynamic"` is NOT needed; `auth()` opts it dynamic automatically. Keep `generateStaticParams` for the non-editor public render path is fine, but since `auth()` forces dynamic, static params become moot — that's an acceptable tradeoff for editor controls on this page. (The home collection stays static.)

- [ ] **Step 3:** Verify build (env-prefixed). The recipe detail route may shift from SSG to dynamic `ƒ` — that's expected and acceptable. Commit: `git add "src/app/(site)/recipe/[slug]/page.tsx" src/components/editor-actions.tsx && git commit -m "feat: editor quick-actions (rating, made-it, wishlist) on recipe detail"`

---

## Task 7: Recipe form + new/edit pages (editor-gated)

- [ ] **Step 1: `src/components/recipe-form.tsx`** (client) — a straightforward editorial form. Fields: title, description, story, cover image (file), prepTime/cookTime/servings, dynamic ingredient rows (name with `<datalist>` of existing ingredient names + quantity + unit), dynamic step rows, tag checkboxes. Submits via a bound server action. Use `useActionState`/`useTransition`. Provide initial values for edit mode.
```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveRecipe } from "@/app/actions/recipe-actions";
import type { IngredientOption, TagOption, RecipeEditData } from "@/sanity/types";

type Row = { name: string; quantity: string; unit: string };

export function RecipeForm({
  recipeId = null,
  initial,
  ingredients,
  tags,
}: {
  recipeId?: string | null;
  initial?: RecipeEditData | null;
  ingredients: IngredientOption[];
  tags: TagOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>(
    initial?.ingredients?.map((i) => ({
      name: i.name ?? "",
      quantity: i.quantity ?? "",
      unit: i.unit ?? "",
    })) ?? [{ name: "", quantity: "", unit: "" }],
  );
  const [steps, setSteps] = useState<string[]>(initial?.steps ?? [""]);

  function onSubmit(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await saveRecipe(recipeId, formData);
      if (res.ok) router.push(`/recipe/${res.slug}`);
      else setError(res.error);
    });
  }

  const labelCls = "kicker text-ink-soft";
  const inputCls =
    "mt-1 w-full border-b border-ink/25 bg-transparent pb-1 text-ink focus:border-heather";

  return (
    <form action={onSubmit} className="space-y-8">
      {error ? <p className="text-clay">{error}</p> : null}

      <label className="block">
        <span className={labelCls}>Title</span>
        <input name="title" defaultValue={initial?.title ?? ""} required className={inputCls} />
      </label>

      <label className="block">
        <span className={labelCls}>Description</span>
        <textarea name="description" defaultValue={initial?.description ?? ""} rows={2} className={inputCls} />
      </label>

      <label className="block">
        <span className={labelCls}>Story (optional)</span>
        <textarea name="story" defaultValue={initial?.story ?? ""} rows={3} className={inputCls} />
      </label>

      <label className="block">
        <span className={labelCls}>Cover photo {initial?.hasImage ? "(leave empty to keep current)" : ""}</span>
        <input type="file" name="image" accept="image/*" className="mt-1 block text-ink-soft" />
      </label>

      <div className="grid grid-cols-3 gap-4">
        <label className="block"><span className={labelCls}>Prep (min)</span>
          <input type="number" name="prepTime" min={0} defaultValue={initial?.prepTime ?? ""} className={inputCls} /></label>
        <label className="block"><span className={labelCls}>Cook (min)</span>
          <input type="number" name="cookTime" min={0} defaultValue={initial?.cookTime ?? ""} className={inputCls} /></label>
        <label className="block"><span className={labelCls}>Servings</span>
          <input type="number" name="servings" min={1} defaultValue={initial?.servings ?? ""} className={inputCls} /></label>
      </div>

      <fieldset>
        <legend className={labelCls}>Ingredients</legend>
        <datalist id="ingredient-options">
          {ingredients.map((i) => <option key={i._id} value={i.name} />)}
        </datalist>
        <div className="mt-2 space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input name="ingQty" defaultValue={row.quantity} placeholder="1" className="w-16 border-b border-ink/25 bg-transparent pb-1 text-ink focus:border-heather" />
              <input name="ingUnit" defaultValue={row.unit} placeholder="cup" className="w-20 border-b border-ink/25 bg-transparent pb-1 text-ink focus:border-heather" />
              <input name="ingName" defaultValue={row.name} list="ingredient-options" placeholder="ingredient" className="flex-1 border-b border-ink/25 bg-transparent pb-1 text-ink focus:border-heather" />
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setRows((r) => [...r, { name: "", quantity: "", unit: "" }])} className="kicker mt-2 text-heather">+ add ingredient</button>
      </fieldset>

      <fieldset>
        <legend className={labelCls}>Steps</legend>
        <div className="mt-2 space-y-2">
          {steps.map((s, i) => (
            <textarea key={i} name="step" defaultValue={s} rows={2} placeholder={`Step ${i + 1}`} className="w-full border border-ink/15 bg-paper p-2 text-ink focus:border-heather" />
          ))}
        </div>
        <button type="button" onClick={() => setSteps((s) => [...s, ""])} className="kicker mt-2 text-heather">+ add step</button>
      </fieldset>

      {tags.length > 0 && (
        <fieldset>
          <legend className={labelCls}>Tags</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {tags.map((t) => (
              <label key={t._id} className="flex items-center gap-1 text-ink-soft">
                <input type="checkbox" name="tag" value={t._id} defaultChecked={initial?.tagIds?.includes(t._id) ?? false} />
                <span className="kicker">{t.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <button type="submit" disabled={pending} className="kicker border border-heather bg-heather-wash px-4 py-2 text-heather hover:bg-heather hover:text-paper disabled:opacity-50">
        {pending ? "Saving…" : recipeId ? "Save changes" : "Create recipe"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: `src/app/(site)/recipe/new/page.tsx`** (gated)
```tsx
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { client } from "@/sanity/lib/client";
import { INGREDIENTS_QUERY, TAGS_QUERY } from "@/sanity/lib/queries";
import type { IngredientOption, TagOption } from "@/sanity/types";
import { RecipeForm } from "@/components/recipe-form";

export default async function NewRecipePage() {
  const viewer = await getViewer();
  if (!viewer.isEditor) redirect("/");
  const [ingredients, tags] = await Promise.all([
    client.fetch<IngredientOption[]>(INGREDIENTS_QUERY),
    client.fetch<TagOption[]>(TAGS_QUERY),
  ]);
  return (
    <section className="mx-auto max-w-2xl">
      <h1 className="editorial-display text-4xl text-ink">New recipe</h1>
      <div className="mt-6">
        <RecipeForm ingredients={ingredients} tags={tags} />
      </div>
    </section>
  );
}
```

- [ ] **Step 3: `src/app/(site)/recipe/[slug]/edit/page.tsx`** (gated)
```tsx
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { client } from "@/sanity/lib/client";
import {
  RECIPE_EDIT_QUERY,
  INGREDIENTS_QUERY,
  TAGS_QUERY,
} from "@/sanity/lib/queries";
import type { RecipeEditData, IngredientOption, TagOption } from "@/sanity/types";
import { RecipeForm } from "@/components/recipe-form";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer.isEditor) redirect("/");
  const { slug } = await params;
  const [recipe, ingredients, tags] = await Promise.all([
    client.withConfig({ useCdn: false }).fetch<RecipeEditData | null>(RECIPE_EDIT_QUERY, { slug }),
    client.fetch<IngredientOption[]>(INGREDIENTS_QUERY),
    client.fetch<TagOption[]>(TAGS_QUERY),
  ]);
  if (!recipe) notFound();
  return (
    <section className="mx-auto max-w-2xl">
      <h1 className="editorial-display text-4xl text-ink">Edit recipe</h1>
      <div className="mt-6">
        <RecipeForm recipeId={recipe._id} initial={recipe} ingredients={ingredients} tags={tags} />
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Add a "New recipe" link for editors on the home page.** In `src/app/(site)/page.tsx`, after fetching, read the viewer and render a link when editor:
  - `import { getViewer } from "@/lib/viewer";` and `import Link from "next/link";`
  - `const viewer = await getViewer();` (this makes home dynamic — acceptable; if you want to keep home static, instead place the "New recipe" link inside the client `AuthControls`/a small editor island. SIMPLER ACCEPTED APPROACH: keep home static and add the "New recipe" link to the editor's view via the existing client `AuthControls` is out of scope; for Phase 6 it is acceptable for `/` to become dynamic. Choose: render `{viewer.isEditor && <Link href="/recipe/new" className="kicker text-heather">New recipe</Link>}` in the header area of the page.)
  - NOTE: if making `/` dynamic is undesirable, skip the home link and rely on the `/recipe/new` route + the per-recipe Edit link; document the choice. Either is acceptable — pick keeping the link and letting `/` be dynamic, and remove `export const revalidate` from the home page.

- [ ] **Step 5: Verify** env-prefixed `npm run build` compiles (`/recipe/new`, `/recipe/[slug]/edit` present and dynamic; `/recipe/[slug]` dynamic). `npm test`, `npm run lint`, `npx tsc --noEmit`. Commit: `git add "src/app/(site)/recipe/new" "src/app/(site)/recipe/[slug]/edit" src/components/recipe-form.tsx "src/app/(site)/page.tsx" && git commit -m "feat: editor add/edit recipe form + gated routes"`

---

## Task 8: Phase gate
- [ ] `npm test` (prior 43 + upsertRating 2 + slugify 2 = 47), `npm run lint` (0), `npx tsc --noEmit`, `npm audit` (0), env-prefixed `npm run build`. Report. Note: writes require `SANITY_API_WRITE_TOKEN` in `.env.local` at runtime; not testable here without it.

---

## Self-Review
**Spec coverage (Phase 6: server-action writes w/ token, add/edit forms, per-editor ratings, made-it, wishlist):** write client (Task 1) ✓; per-editor rating via upsertRating + rateRecipe + interactive stars (Tasks 2,5,6) ✓; made-it (Task 5,6) ✓; wishlist (Task 5,6) ✓; add/edit form + gated routes (Task 7) ✓; all writes gated by `requireEditor()` (Task 5) ✓.
**Security:** every action calls `requireEditor()` first; write token only in the lazy server client (never client); rating value clamped 0–5; ingredient resolution uses parameterized GROQ. Editor-only UI is gated server-side (redirect for non-editors) — the client island is convenience, the action is the real gate.
**Design.md:** ochre interactive stars, clay "made it", heather wishlist/links, editorial form (hairline inputs, kicker labels), no emoji (the ★ is a typographic control glyph).
**Placeholders:** none.
**Type consistency:** `StoredRating` (rating-mutate) used by action + matches schema `rating` object. `RecipeEditData` (types) matches `RECIPE_EDIT_QUERY` projection and `RecipeForm` initial. `requireEditor()` returns `editorId: string`.
**Risks:** (1) image upload via `assets.upload` in a server action with a `File` from FormData — Next 16 supports File in server actions; verify. (2) `getViewer()`/`auth()` on the detail + home pages forces them dynamic — accepted tradeoff (editor controls need session); the collection filtering still works (client-side). (3) writes need the token at runtime — documented. (4) New ingredients created by `saveRecipe` get only a `name` (no category) — editors can categorize later in Studio; acceptable.
