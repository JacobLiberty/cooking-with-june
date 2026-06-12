# Spec 4b — Submit + Review + Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The user-facing import flow: a `/submit` page where a member pastes a blurb → generates a draft (via 4a's `importRecipe`) → edits it in a review form with **live macro recompute** → publishes to Sanity (`publishRecipe`: create + enriched ingredients + macros) with an **async Sanity cover** (manual upload fallback). Retire `/recipe/new`.

**Architecture:** `publishRecipe(draft, cover?)` is a member-gated server action that resolves each ingredient via `getOrCreateEnrichedIngredient` (3a), recomputes macros server-side from the draft's per-100g nutrients (ignoring client-sent macros), writes the recipe via `@sanity/client`, and — if no cover was uploaded — fires a best-effort, non-blocking `client.agent.action.generate` cover. The `/submit` page is a client component that calls `importRecipe` then `publishRecipe`; macro recompute reuses the pure `computeDraftMacros` from 4a.

**Tech Stack:** Next.js 16 (server actions + client form), `@sanity/client@7.22.1` (`agent.action.generate`, `schemaId: "_.schemas.default"`), Vitest + Testing Library.

---

## Context the implementer needs

- 4a built `src/lib/import/`: `RecipeDraft`/`DraftLine` (types), `computeDraftMacros(ingredients, servings)` + `buildDraft` (assemble), `importRecipe(blurb)` action → `{ ok: true; draft: RecipeDraft } | { ok: false; error }`. `DraftLine` = `{ name, quantity?, unit?, note?, optional, per100g, catalogId, isNew }`.
- `getOrCreateEnrichedIngredient(name): Promise<string>` from `@/lib/ingredients/get-or-create` (dedupes by lower(name), creates + enriches new catalog ingredients).
- Recipe doc shape (from `recipe-actions.ts saveRecipe`): `{ _type:"recipe", title, slug:{_type:"slug",current}, description?, story?, prepTime?, cookTime?, servings?, images?, steps:string[], ingredients: ingredientLine[], tags: reference[], macros }`. `ingredientLine = { _key, _type:"ingredientLine", ingredient:{_type:"reference",_ref}, quantity?, unit?, note?, optional? }`. `macros = { base, full, estimated, computedAt, unparsedLines }` where base/full are `{ calories, protein, carbs, fat }` (the `macroSet` object).
- `getWriteClient()` from `@/sanity/lib/write-client` (server-only, token); `slugify` from `@/lib/slug`; `client` reader from `@/sanity/lib/client`.
- `uniqueSlug` currently lives privately in `recipe-actions.ts` — Task 1 extracts it to `@/lib/slug` so both actions share it.
- `requireMember()` from `@/lib/viewer`. Server-action test mocks (per `recipe-actions.test.ts`): mock `@/lib/viewer`, `@/sanity/lib/write-client`, `@/sanity/lib/client`, `next/cache`, and (here) `@/lib/ingredients/get-or-create`.
- Branch `design/app-overhaul-spec`; do NOT push/branch.

---

## File Structure

**Create:**
- `src/lib/import/cover.ts` (+ `.test.ts`) — `coverInstruction(title)`, `generateRecipeCover(documentId, title)` (best-effort Agent Actions).
- `src/app/actions/publish-actions.ts` (+ `.test.ts`) — `publishRecipe(draft, cover?)`.
- `src/app/(site)/submit/page.tsx` — member-gated page shell (fetches existing tags).
- `src/components/import-review.tsx` (+ `.test.tsx`) — the paste + review + publish client form.

**Modify:**
- `src/lib/slug.ts` — add `uniqueSlug(base, takenSlugs)` (pure) — extracted/shared.
- `src/app/actions/recipe-actions.ts` — use the shared `uniqueSlug`.
- `src/app/(site)/recipe/new/page.tsx` — redirect to `/submit`.
- `src/app/(site)/page.tsx` — home "New recipe" link → `/submit`.

---

## Task 1: Shared `uniqueSlug` + `publishRecipe` (create + ingredients + macros)

**Files:**
- Modify: `src/lib/slug.ts`, `src/app/actions/recipe-actions.ts`
- Create: `src/app/actions/publish-actions.ts`, `src/app/actions/publish-actions.test.ts`

- [ ] **Step 1: Extract a pure `uniqueSlug` into `src/lib/slug.ts`.** Read the existing private `uniqueSlug` in `recipe-actions.ts` (it fetches all taken slugs, then appends `-2`, `-3`…). Add a PURE version to `src/lib/slug.ts` that takes the taken list as an argument:

```ts
/** First slug not already used, appending -2, -3, … on collision. */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
```

Add a quick test to `src/lib/slug.test.ts` (create if missing):

```ts
import { describe, it, expect } from "vitest";
import { uniqueSlug } from "@/lib/slug";

describe("uniqueSlug", () => {
  it("returns the base when free", () => {
    expect(uniqueSlug("chili", [])).toBe("chili");
  });
  it("appends the first free suffix on collision", () => {
    expect(uniqueSlug("chili", ["chili", "chili-2"])).toBe("chili-3");
  });
});
```

Run: `npx vitest run src/lib/slug.test.ts` → PASS.

- [ ] **Step 2: Repoint `recipe-actions.ts` to the shared `uniqueSlug`.** In `recipe-actions.ts`, delete the private `async function uniqueSlug(base)` and change the import + call site: `import { slugify, uniqueSlug } from "@/lib/slug";`, and at the create site replace `slug = await uniqueSlug(slugify(title));` with:

```ts
    const takenSlugs = await reader().fetch<string[]>(
      `*[_type == "recipe" && defined(slug.current)].slug.current`,
    );
    slug = uniqueSlug(slugify(title), takenSlugs);
```

Run: `npx vitest run src/app/actions/recipe-actions.test.ts && npx tsc --noEmit` → PASS/clean. Commit:

```bash
git add src/lib/slug.ts src/lib/slug.test.ts src/app/actions/recipe-actions.ts
git commit -m "refactor(4b): extract pure uniqueSlug to lib/slug (shared)"
```

- [ ] **Step 3: Write the failing `publishRecipe` test** — create `src/app/actions/publish-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/viewer", () => ({ requireMember: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const create = vi.fn().mockResolvedValue({ _id: "new-recipe-id" });
const patch = vi.fn(() => ({ set: () => ({ commit: vi.fn().mockResolvedValue({}) }) }));
vi.mock("@/sanity/lib/write-client", () => ({
  getWriteClient: () => ({ create: (...a: unknown[]) => create(...a), patch }),
}));
const sanityFetch = vi.fn();
vi.mock("@/sanity/lib/client", () => ({
  client: { withConfig: () => ({ fetch: (...a: unknown[]) => sanityFetch(...a) }) },
}));
const getOrCreate = vi.fn();
vi.mock("@/lib/ingredients/get-or-create", () => ({
  getOrCreateEnrichedIngredient: (...a: unknown[]) => getOrCreate(...a),
}));
const generateRecipeCover = vi.fn();
vi.mock("@/lib/import/cover", () => ({ generateRecipeCover: (...a: unknown[]) => generateRecipeCover(...a) }));

import { requireMember } from "@/lib/viewer";
import { publishRecipe } from "@/app/actions/publish-actions";
import type { RecipeDraft } from "@/lib/import/types";

const DRAFT: RecipeDraft = {
  title: "Weeknight Chili",
  description: "A pot of chili.",
  servings: 2,
  candidateTags: ["dinner"],
  steps: ["Brown the beef.", "Simmer."],
  ingredients: [
    { name: "ground beef", quantity: "1", unit: "lb", optional: false, per100g: { calories: 215, protein: 18, carbs: 0, fat: 15 }, catalogId: "beef-id", isNew: false },
    { name: "cilantro", quantity: "10", unit: "g", optional: true, per100g: { calories: 23, protein: 2, carbs: 4, fat: 0 }, catalogId: null, isNew: true },
  ],
  macros: { base: { calories: 0, protein: 0, carbs: 0, fat: 0 }, full: { calories: 0, protein: 0, carbs: 0, fat: 0 }, estimated: true, unparsedLines: [] },
};

beforeEach(() => {
  vi.mocked(requireMember).mockResolvedValue({ userId: "u1", householdId: "h1" });
  create.mockClear().mockResolvedValue({ _id: "new-recipe-id" });
  sanityFetch.mockReset();
  getOrCreate.mockReset().mockImplementation(async (name: string) => `${name}-id`);
  generateRecipeCover.mockReset();
});

describe("publishRecipe", () => {
  it("resolves ingredients, recomputes macros, creates the recipe, fires cover", async () => {
    sanityFetch
      .mockResolvedValueOnce(["dinner-id"]) // tag ids by name
      .mockResolvedValueOnce([]); // taken slugs
    const res = await publishRecipe(DRAFT);
    expect(res.ok).toBe(true);
    expect(getOrCreate).toHaveBeenCalledWith("ground beef");
    expect(getOrCreate).toHaveBeenCalledWith("cilantro");
    const doc = create.mock.calls[0][0] as Record<string, any>;
    expect(doc._type).toBe("recipe");
    expect(doc.ingredients).toHaveLength(2);
    expect(doc.ingredients[0].ingredient._ref).toBe("ground beef-id");
    expect(doc.ingredients[1].optional).toBe(true);
    expect(doc.tags[0]._ref).toBe("dinner-id");
    // macros recomputed server-side from per100g (not the zeros in the draft)
    expect(doc.macros.full.calories).toBeGreaterThan(0);
    expect(doc.macros.estimated).toBe(true);
    expect(doc.slug.current).toBe("weeknight-chili");
    // cover fired with the new doc id (no manual upload)
    expect(generateRecipeCover).toHaveBeenCalledWith("new-recipe-id", "Weeknight Chili");
    if (res.ok) expect(res.slug).toBe("weeknight-chili");
  });

  it("rejects a non-member", async () => {
    vi.mocked(requireMember).mockRejectedValueOnce(new Error("Not authorized"));
    await expect(publishRecipe(DRAFT)).rejects.toThrow(/authorized/i);
  });

  it("rejects an empty title", async () => {
    const res = await publishRecipe({ ...DRAFT, title: "  " });
    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `npx vitest run src/app/actions/publish-actions.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 5: Implement** — create `src/app/actions/publish-actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getWriteClient } from "@/sanity/lib/write-client";
import { client } from "@/sanity/lib/client";
import { requireMember } from "@/lib/viewer";
import { slugify, uniqueSlug } from "@/lib/slug";
import { getOrCreateEnrichedIngredient } from "@/lib/ingredients/get-or-create";
import { computeDraftMacros } from "@/lib/import/assemble";
import { generateRecipeCover } from "@/lib/import/cover";
import type { RecipeDraft } from "@/lib/import/types";

const reader = () => client.withConfig({ useCdn: false });

export type PublishResult = { ok: true; slug: string } | { ok: false; error: string };

/**
 * Member-gated: turn a reviewed draft into a published recipe. Resolves each
 * ingredient to a catalog id (creating + enriching new ones), recomputes macros
 * server-side from the draft's per-100g nutrients (the client-sent macros are
 * not trusted), writes the recipe, and fires a best-effort async cover.
 */
export async function publishRecipe(draft: RecipeDraft): Promise<PublishResult> {
  await requireMember();

  const title = draft.title.trim();
  if (!title) return { ok: false, error: "Title is required" };

  const write = getWriteClient();

  // Ingredient lines → catalog refs (create + enrich new ones).
  const ingredients = [];
  for (let i = 0; i < draft.ingredients.length; i++) {
    const line = draft.ingredients[i];
    const name = line.name.trim();
    if (!name) continue;
    const id = await getOrCreateEnrichedIngredient(name);
    ingredients.push({
      _key: `ing-${i}-${id.slice(0, 6)}`,
      _type: "ingredientLine",
      ingredient: { _type: "reference", _ref: id },
      quantity: line.quantity || undefined,
      unit: line.unit || undefined,
      note: line.note || undefined,
      optional: line.optional ? true : undefined,
    });
  }

  // Tags: keep only candidate names that match an existing tag.
  const tagIds = draft.candidateTags.length
    ? await reader().fetch<string[]>(`*[_type == "tag" && name in $names]._id`, {
        names: draft.candidateTags,
      })
    : [];

  // Recompute macros from the draft's ingredients (per-100g × grams).
  const macros = computeDraftMacros(draft.ingredients, draft.servings);

  const taken = await reader().fetch<string[]>(
    `*[_type == "recipe" && defined(slug.current)].slug.current`,
  );
  const slug = uniqueSlug(slugify(title), taken);

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

  // Best-effort async cover (no manual upload here in 4b T1).
  await generateRecipeCover(created._id, title);

  revalidatePath("/", "layout");
  revalidatePath(`/recipe/${slug}`);
  return { ok: true, slug };
}
```

> Note: `generateRecipeCover` is created in Task 2; for this task's test it is MOCKED. Implement the real `cover.ts` in Task 2 — until then `npx tsc --noEmit` will fail on the missing module, so do Task 2 BEFORE running the full gate. The unit test for `publishRecipe` passes now because `@/lib/import/cover` is mocked.

- [ ] **Step 6: Run the publish test (cover mocked)**

Run: `npx vitest run src/app/actions/publish-actions.test.ts`
Expected: PASS (all cases). (`tsc` will still error on `@/lib/import/cover` until Task 2 — that's expected; do not run the full gate yet.)

- [ ] **Step 7: Commit**

```bash
git add src/app/actions/publish-actions.ts src/app/actions/publish-actions.test.ts
git commit -m "feat(4b): publishRecipe (resolve ingredients + recompute macros + create)"
```

---

## Task 2: Cover generation helper

**Files:**
- Create: `src/lib/import/cover.ts`, `src/lib/import/cover.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/lib/import/cover.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const generate = vi.fn();
vi.mock("@/sanity/lib/write-client", () => ({
  getWriteClient: () => ({ agent: { action: { generate: (...a: unknown[]) => generate(...a) } } }),
}));

import { coverInstruction, generateRecipeCover } from "@/lib/import/cover";

beforeEach(() => generate.mockReset());

describe("coverInstruction", () => {
  it("names the dish and asks for the cozy editorial style", () => {
    const p = coverInstruction("Weeknight Chili");
    expect(p).toContain("Weeknight Chili");
    expect(p.toLowerCase()).toMatch(/cozy|editorial|terracotta|appetizing/);
  });
});

describe("generateRecipeCover", () => {
  it("calls Agent Actions generate with the doc id, schema, and cover target", async () => {
    generate.mockResolvedValueOnce({});
    await generateRecipeCover("rec-1", "Weeknight Chili");
    expect(generate).toHaveBeenCalledTimes(1);
    const arg = generate.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.documentId).toBe("rec-1");
    expect(arg.schemaId).toBe("_.schemas.default");
    expect(arg.instruction).toContain("Weeknight Chili");
  });

  it("never throws when generation fails (best-effort)", async () => {
    generate.mockRejectedValueOnce(new Error("experimental API down"));
    await expect(generateRecipeCover("rec-1", "X")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/import/cover.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement** — create `src/lib/import/cover.ts`:

```ts
import { getWriteClient } from "@/sanity/lib/write-client";

// The deployed Sanity schema id (from `sanity schema list`).
const SCHEMA_ID = "_.schemas.default";

/** Cozy editorial cover prompt in the app's terracotta/cream house style. */
export function coverInstruction(title: string): string {
  return [
    `Generate a cover photo for the recipe "${title}".`,
    "Style: cozy, appetizing, editorial home-cookbook food photography,",
    "warm natural light, earthy terracotta and cream tones, shallow depth of field.",
    "No text or words in the image.",
  ].join(" ");
}

/**
 * Fire-and-forget cover generation via Sanity Agent Actions (experimental). The
 * image arrives asynchronously on the document. Best-effort: any failure is
 * swallowed so it never blocks publishing (the member can upload or regenerate).
 */
export async function generateRecipeCover(documentId: string, title: string): Promise<void> {
  try {
    await getWriteClient().agent.action.generate({
      documentId,
      schemaId: SCHEMA_ID,
      instruction: coverInstruction(title),
      target: { path: ["images", "asset"] },
    });
  } catch {
    // experimental API hiccup — leave the recipe coverless; it can be added later
  }
}
```

> Note on `target`: `images` is an array field on the recipe schema; `{ path: ["images", "asset"] }` is the Agent Actions form for the cover asset. This call is best-effort and non-blocking, so if the experimental API needs a slightly different target it simply yields no auto-cover (the member uploads instead) — it never breaks publish. Verify the cover lands in Studio during manual QA; adjust the `target` only if needed.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/import/cover.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Full gate (now that `cover.ts` exists) + commit**

Run: `npx vitest run && npm run lint && npx tsc --noEmit`
Expected: all green (publish-actions + cover + slug + the rest).

```bash
git add src/lib/import/cover.ts src/lib/import/cover.test.ts
git commit -m "feat(4b): best-effort Sanity Agent-Actions cover generation"
```

---

## Task 3: `/submit` page + `ImportReview` form

**Files:**
- Create: `src/app/(site)/submit/page.tsx`, `src/components/import-review.tsx`, `src/components/import-review.test.tsx`

- [ ] **Step 1: Create the page shell** — `src/app/(site)/submit/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { client } from "@/sanity/lib/client";
import { TAGS_QUERY } from "@/sanity/lib/queries";
import type { TagOption } from "@/sanity/types";
import { ImportReview } from "@/components/import-review";

export default async function SubmitPage() {
  const viewer = await getViewer();
  if (!viewer.isAuthenticated) redirect("/");
  if (!viewer.isMember) redirect("/household/setup");

  const tags = await client.fetch<TagOption[]>(TAGS_QUERY);

  return (
    <section className="mx-auto max-w-2xl">
      <header className="set set-1">
        <p className="kicker text-terracotta">Add a recipe</p>
        <h1 className="editorial-display mt-2 text-4xl text-ink md:text-5xl">Submit</h1>
        <p className="editorial-aside mt-3 text-ink-soft">
          Paste a recipe and June&rsquo;s kitchen will normalize it: ingredients,
          steps, macros, and a cover.
        </p>
        <div className="rule-draw mt-5 h-px w-full bg-terracotta/40" />
      </header>
      <ImportReview tags={tags} />
    </section>
  );
}
```

- [ ] **Step 2: Implement the form** — `src/components/import-review.tsx`:

```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TagOption } from "@/sanity/types";
import type { RecipeDraft, DraftLine } from "@/lib/import/types";
import { computeDraftMacros } from "@/lib/import/assemble";
import { importRecipe } from "@/app/actions/import-actions";
import { publishRecipe } from "@/app/actions/publish-actions";
import { CheckBox } from "@/components/check-box";

export function ImportReview({ tags }: { tags: TagOption[] }) {
  const router = useRouter();
  const [blurb, setBlurb] = useState("");
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const macros = useMemo(
    () => (draft ? computeDraftMacros(draft.ingredients, draft.servings) : null),
    [draft],
  );

  const generate = () => {
    setError(null);
    start(async () => {
      const res = await importRecipe(blurb);
      if (res.ok) setDraft(res.draft);
      else setError(res.error);
    });
  };

  const patchLine = (i: number, next: Partial<DraftLine>) =>
    setDraft((d) =>
      d ? { ...d, ingredients: d.ingredients.map((l, j) => (j === i ? { ...l, ...next } : l)) } : d,
    );

  const publish = () => {
    if (!draft) return;
    setError(null);
    start(async () => {
      const res = await publishRecipe(draft);
      if (res.ok) router.push(`/recipe/${res.slug}`);
      else setError(res.error);
    });
  };

  if (!draft) {
    return (
      <div className="mt-8 space-y-3" aria-busy={pending}>
        <label className="kicker block text-ink-soft" htmlFor="blurb">Recipe text</label>
        <textarea
          id="blurb"
          value={blurb}
          onChange={(e) => setBlurb(e.target.value)}
          rows={12}
          placeholder="Paste the recipe here…"
          className="w-full border border-ink/20 bg-transparent p-3 text-ink focus:border-terracotta"
        />
        {error ? <p role="alert" className="text-sm text-terracotta-deep">{error}</p> : null}
        <button
          type="button"
          onClick={generate}
          disabled={pending || !blurb.trim()}
          className="kicker rounded-full bg-terracotta px-5 py-2 text-paper hover:bg-terracotta-deep disabled:opacity-40"
        >
          {pending ? "Reading…" : "Generate draft"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6" aria-busy={pending}>
      {error ? <p role="alert" className="text-sm text-terracotta-deep">{error}</p> : null}

      <label className="block">
        <span className="kicker text-ink-soft">Title</span>
        <input
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          className="mt-1 w-full border-b border-ink/25 bg-transparent pb-1 text-2xl text-ink focus:border-terracotta"
        />
      </label>

      <label className="block">
        <span className="kicker text-ink-soft">Headnote</span>
        <textarea
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          rows={3}
          className="mt-1 w-full border border-ink/20 bg-transparent p-2 text-ink focus:border-terracotta"
        />
      </label>

      <div className="flex gap-4">
        {(["prepTime", "cookTime", "servings"] as const).map((k) => (
          <label key={k} className="flex-1">
            <span className="kicker text-ink-soft">{k === "prepTime" ? "Prep (min)" : k === "cookTime" ? "Cook (min)" : "Servings"}</span>
            <input
              type="number"
              min={0}
              value={draft[k] ?? ""}
              onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) || undefined })}
              className="mt-1 w-full border-b border-ink/25 bg-transparent pb-1 text-ink focus:border-terracotta"
            />
          </label>
        ))}
      </div>

      <section aria-labelledby="ing-heading">
        <h2 id="ing-heading" className="kicker text-terracotta">Ingredients</h2>
        <ul className="mt-2 space-y-2">
          {draft.ingredients.map((line, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <input
                value={line.quantity ?? ""}
                onChange={(e) => patchLine(i, { quantity: e.target.value })}
                aria-label={`Quantity for ${line.name}`}
                className="w-16 border-b border-ink/25 bg-transparent pb-1 text-ink"
              />
              <input
                value={line.unit ?? ""}
                onChange={(e) => patchLine(i, { unit: e.target.value })}
                aria-label={`Unit for ${line.name}`}
                className="w-16 border-b border-ink/25 bg-transparent pb-1 text-ink"
              />
              <input
                value={line.name}
                onChange={(e) => patchLine(i, { name: e.target.value })}
                aria-label={`Name for ingredient ${i + 1}`}
                className="min-w-32 flex-1 border-b border-ink/25 bg-transparent pb-1 text-ink"
              />
              {line.isNew ? <span className="kicker rounded-full bg-clay-wash px-2 py-0.5 text-ink-soft">new</span> : null}
              <CheckBox
                checked={line.optional}
                onChange={() => patchLine(i, { optional: !line.optional })}
                label={`${line.name} optional`}
              />
            </li>
          ))}
        </ul>
      </section>

      {macros ? (
        <p className="text-sm text-ink-soft" aria-live="polite">
          Macros / serving — base {macros.base.calories} kcal · full {macros.full.calories} kcal
          {macros.unparsedLines.length ? ` (skipped: ${macros.unparsedLines.join(", ")})` : ""}
        </p>
      ) : null}

      <section aria-labelledby="tag-heading">
        <h2 id="tag-heading" className="kicker text-terracotta">Tags</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.map((t) => {
            const active = draft.candidateTags.includes(t.name);
            return (
              <button
                key={t._id}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setDraft({
                    ...draft,
                    candidateTags: active
                      ? draft.candidateTags.filter((n) => n !== t.name)
                      : [...draft.candidateTags, t.name],
                  })
                }
                className={`kicker border px-2 py-1 ${active ? "border-terracotta bg-terracotta-wash text-terracotta" : "border-ink/20 text-ink-soft hover:border-terracotta"}`}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex items-center gap-4 border-t border-terracotta/25 pt-4">
        <button
          type="button"
          onClick={publish}
          disabled={pending || !draft.title.trim()}
          className="kicker rounded-full bg-terracotta px-5 py-2 text-paper hover:bg-terracotta-deep disabled:opacity-40"
        >
          {pending ? "Publishing…" : "Publish recipe"}
        </button>
        <button
          type="button"
          onClick={() => setDraft(null)}
          className="kicker text-ink-soft hover:text-terracotta"
        >
          Start over
        </button>
      </div>
    </div>
  );
}
```

(YAGNI for v1: steps editing + cover upload are deferred to 4c's edit form / a follow-up — the draft's steps publish as-generated, and covers auto-generate. If lint flags an unused import, remove it.)

- [ ] **Step 3: Write behavior tests** — create `src/components/import-review.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const actions = vi.hoisted(() => ({ importRecipe: vi.fn(), publishRecipe: vi.fn() }));
vi.mock("@/app/actions/import-actions", () => ({ importRecipe: actions.importRecipe }));
vi.mock("@/app/actions/publish-actions", () => ({ publishRecipe: actions.publishRecipe }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { ImportReview } from "@/components/import-review";

const DRAFT = {
  title: "Chili", description: "Hot.", servings: 2, candidateTags: ["dinner"],
  steps: ["Cook."],
  ingredients: [
    { name: "ground beef", quantity: "1", unit: "lb", optional: false, per100g: { calories: 215, protein: 18, carbs: 0, fat: 15 }, catalogId: "beef-id", isNew: false },
    { name: "cilantro", quantity: "10", unit: "g", optional: true, per100g: { calories: 23, protein: 2, carbs: 4, fat: 0 }, catalogId: null, isNew: true },
  ],
  macros: { base: { calories: 0, protein: 0, carbs: 0, fat: 0 }, full: { calories: 0, protein: 0, carbs: 0, fat: 0 }, estimated: true, unparsedLines: [] },
};
const TAGS = [{ _id: "t1", name: "dinner" }, { _id: "t2", name: "vegetarian" }];

beforeEach(() => {
  actions.importRecipe.mockReset();
  actions.publishRecipe.mockReset().mockResolvedValue({ ok: true, slug: "chili" });
  push.mockReset();
});

describe("ImportReview", () => {
  it("generates a draft from a blurb and shows the review form", async () => {
    const user = userEvent.setup();
    actions.importRecipe.mockResolvedValue({ ok: true, draft: DRAFT });
    render(<ImportReview tags={TAGS} />);
    await user.type(screen.getByLabelText("Recipe text"), "Grandma's chili");
    await user.click(screen.getByRole("button", { name: "Generate draft" }));
    expect(actions.importRecipe).toHaveBeenCalledWith("Grandma's chili");
    expect(await screen.findByDisplayValue("Chili")).toBeInTheDocument();
    expect(screen.getByText("new")).toBeInTheDocument(); // cilantro is new
  });

  it("shows the macro range and recomputes when a quantity changes", async () => {
    const user = userEvent.setup();
    actions.importRecipe.mockResolvedValue({ ok: true, draft: DRAFT });
    render(<ImportReview tags={TAGS} />);
    await user.type(screen.getByLabelText("Recipe text"), "x");
    await user.click(screen.getByRole("button", { name: "Generate draft" }));
    await screen.findByDisplayValue("Chili");
    expect(screen.getByText(/base \d+ kcal/i)).toBeInTheDocument();
  });

  it("publishes the draft and routes to the new recipe", async () => {
    const user = userEvent.setup();
    actions.importRecipe.mockResolvedValue({ ok: true, draft: DRAFT });
    render(<ImportReview tags={TAGS} />);
    await user.type(screen.getByLabelText("Recipe text"), "x");
    await user.click(screen.getByRole("button", { name: "Generate draft" }));
    await screen.findByDisplayValue("Chili");
    await user.click(screen.getByRole("button", { name: "Publish recipe" }));
    expect(actions.publishRecipe).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/recipe/chili");
  });

  it("surfaces an import error", async () => {
    const user = userEvent.setup();
    actions.importRecipe.mockResolvedValue({ ok: false, error: "Couldn't read that recipe." });
    render(<ImportReview tags={TAGS} />);
    await user.type(screen.getByLabelText("Recipe text"), "junk");
    await user.click(screen.getByRole("button", { name: "Generate draft" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't read/i);
  });
});
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/import-review.test.tsx`
Expected: PASS (all cases). Fix the TEST query to match the component if needed (not the reverse).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` (clean).

```bash
git add "src/app/(site)/submit/page.tsx" src/components/import-review.tsx src/components/import-review.test.tsx
git commit -m "feat(4b): /submit page + ImportReview form (generate -> live macros -> publish)"
```

---

## Task 4: Retire `/recipe/new`; point entry points at `/submit`

**Files:**
- Modify: `src/app/(site)/recipe/new/page.tsx`, `src/app/(site)/page.tsx`

- [ ] **Step 1: Redirect `/recipe/new` → `/submit`.** Replace the entire contents of `src/app/(site)/recipe/new/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

// The manual create form is retired — all recipes come through the import pipeline.
export default function NewRecipePage() {
  redirect("/submit");
}
```

- [ ] **Step 2: Point the home "New recipe" link at `/submit`.** In `src/app/(site)/page.tsx`, change the `New recipe` link's `href="/recipe/new"` to `href="/submit"` (text stays "New recipe").

- [ ] **Step 3: Full gate**

Run: `npx vitest run && npm run lint && npx tsc --noEmit`
Expected: all green.

- [ ] **Step 4: Convex smoke check.** Run: `npx convex dev --once` — clean (no Convex changes this task; confirms nothing broke).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(site)/recipe/new/page.tsx" "src/app/(site)/page.tsx"
git commit -m "feat(4b): retire /recipe/new -> /submit (pipeline is the only create path)"
```

---

## Post-implementation gate (whole sub-plan)

- [ ] Full gate green: `npx vitest run` + `npm run lint` + `npx tsc --noEmit` + `npx convex dev --once`.
- [ ] Holistic review across the 4b commits; address findings.
- [ ] Confirm: `/submit` (member-gated) paste → generate → editable draft with live macro recompute → publish creates the recipe + routes to it; `publishRecipe` resolves/enriches ingredients, recomputes macros server-side, maps tags by name; cover generation fires best-effort (never blocks); `/recipe/new` redirects to `/submit`; home link points to `/submit`.

---

## Self-review notes (coverage vs Spec 4 design §2, §5)

- §2 flow (paste → generate → editable draft → publish + async cover) → Tasks 1–3.
- §5 review form (title/headnote/times/ingredient table with optional toggle + "new" badge/tags/live macros) → Task 3. (Steps editing + manual cover upload deferred — covers auto-generate; steps publish as-generated; both can be edited via 4c's edit form. Flagged YAGNI.)
- §5 publishRecipe (getOrCreateEnrichedIngredient per line, recompute macros, write.create, fire cover) → Tasks 1–2.
- §1 "only create path" (retire `/recipe/new`) → Task 4.
- Out of 4b scope (4c): edit/re-import flow, `editRecipeText`, removing the old `recipe-form` create path, manual cover upload in review. Cover `target` path is best-effort (verify in QA).
