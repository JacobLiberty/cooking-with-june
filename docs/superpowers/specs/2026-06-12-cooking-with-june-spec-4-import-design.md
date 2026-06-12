# Spec 4 — Self-Serve Recipe Import Pipeline (design)

> Brainstormed 2026-06-12 on branch `design/app-overhaul-spec` (continues from Specs 1–3, which it depends on). Fourth and final sub-project of the app overhaul.
>
> Reference: master spec `2026-06-11-cooking-with-june-overhaul-design.md` §7; the existing local pipeline in memory `recipe-import-process.md` (which this turns into an in-app flow); reused code: `src/lib/enrichment/` (Anthropic structured-output pattern), `src/lib/macros/` (tested gram + macro math), `src/lib/ingredients/get-or-create.ts` (create-if-missing + enrich), `src/app/actions/recipe-actions.ts` (Sanity write path).

## 1. Goal

Any signed-in member adds a recipe that comes out **equally normalized — catalog-mapped ingredients, optional flags, steps, a macro range, and a cover image — with no one running Claude locally**. The import pipeline becomes the **only** way to create a recipe (the manual create form is retired); editing ingredients re-runs normalization so macros + stock metadata stay correct.

No new dependencies or keys: reuses `ANTHROPIC_API_KEY` (Claude) + `SANITY_API_WRITE_TOKEN` (Sanity write + Agent Actions cover gen). The Agent Actions `schemaId` is `_.schemas.default` (a constant, not a secret).

## 2. Flow (single page, ephemeral draft)

1. Member pastes a recipe blurb on **`/submit`** (member-gated).
2. **"Generate"** → `importRecipe(blurb)` server action: rate-limit check → one Claude call (structured output) → resolve catalog matches + compute macros → returns a **display-ready draft to the browser** (no Sanity writes yet).
3. The draft renders as an **editable review form** with **live, deterministic macro recompute** (toggling optional / editing a quantity recomputes locally — no extra Claude call).
4. **"Publish"** → `publishRecipe(draft)`: create/enrich ingredients → `write.create` the recipe → fire **async Sanity cover generation** on the new doc.
5. The draft lives in browser state until publish (lost on tab close — acceptable for paste-and-review). One clean Sanity write.

## 3. The Claude call — `src/lib/import/`

A module mirroring `src/lib/enrichment/` (Anthropic SDK, **forced `tool_choice`**, **prompt-cached** system block carrying the normalization rules + per-100g macro guidance from `recipe-import-process.md`, **Haiku 4.5 default → Sonnet 4.6 fallback** on unusable output). The forced tool returns:

```
{
  title: string,
  description: string,
  story?: string,
  prepTime?: number, cookTime?: number, servings?: number,
  candidateTags: string[],
  ingredients: [{
    name: string, quantity?: string, unit?: string, note?: string,
    optional: boolean,
    per100g: { calories: number, protein: number, carbs: number, fat: number }
  }],
  steps: string[]
}
```

Claude supplies per-ingredient **per-100g nutrients** (accounting for raw/cooked state + consumed-grams context since it sees the whole recipe) — it does **not** do the arithmetic. Style rules from the memory are baked into the system prompt (plain prose, no em dashes, no AI tells). Output is validated (`validateImportResult`) before use; a schema violation falls back to Sonnet, then surfaces an error rather than publishing garbage.

## 4. Assembly — deterministic, our tested code (`importRecipe`)

After the call the server action builds the draft (no Sanity writes):
- **Catalog mapping:** each ingredient `name` → existing catalog id by `lower(name)` (GROQ `$param`); else flagged `{ status: "new" }` ("will be created + enriched on publish").
- **Macros:** per line, `quantityToGrams(quantity, unit)` × `per100g` → contribution; sum via `sumMacros` into `macros.base` (required only) + `macros.full` (incl. optional), `estimated: true`, `unparsedLines` for any line whose quantity couldn't be parsed. This is the function the review form re-runs **live** when optional/quantity changes (the per-100g values are in the draft).
- Returns `{ fields, ingredients: [{...line, catalogId|null, status}], macros, candidateTags, unparsedLines }`.

## 5. Review form + publish (`/submit`, `publishRecipe`)

Review form (in-memory draft): title/headnote/prep/cook/servings; the **ingredient table** (name, quantity, unit, optional toggle, catalog match — correctable via a catalog typeahead, "new" badge for create-if-missing); **steps** (add/remove/reorder); a **tag multi-select** over existing tags (pre-checked from Claude's matched `candidateTags`); an **optional cover upload**; the **live macro range**.

`publishRecipe(draft)`:
1. For each ingredient line, resolve to a catalog id via `getOrCreateEnrichedIngredient(name)` (reused from 3a — new ingredients get full stock metadata).
2. `write.create` the recipe doc (shape per `recipe-import-process.md` §5: `ingredientLine[]` with refs + optional flags, `steps`, `tags` refs, `macros{base,full,estimated,computedAt,unparsedLines}`, unique slug).
3. **Cover:** if the member uploaded one, attach it (existing image-upload path) and skip generation. Otherwise fire `client.agent.action.generate({ documentId, schemaId: "_.schemas.default", instruction: <cozy editorial terracotta prompt>, target: <cover image asset> })` — **async, non-blocking**; the cover fills in shortly after (Studio shows an in-progress asset). A generation error never blocks publishing (recipe publishes coverless; can be regenerated).
4. Revalidate `/` and the new `/recipe/[slug]`; redirect to the published recipe.

## 6. Editing / re-import

`/recipe/[slug]/edit` becomes a **light text-edit form** (title, description, story, prepTime, cookTime, servings, tags, steps) saved via a text-only **`editRecipeText`** action — no ingredient changes, no Claude. A **"Re-import"** button enters the `/submit` review flow **prefilled** from the current recipe (or paste an updated blurb) → re-runs the pipeline → **`publishRecipe` republishes over the same recipe id** (preserves slug + all Convex ratings / made-state / notes). The old manual ingredient-editing UI in `recipe-form` is removed.

## 7. Rate limit

A Convex table `imports` (or a counter) tracks **imports per user per UTC day**; `importRecipe` checks-and-increments before the Claude call and rejects past the cap (~25/day) with a friendly message. Derives the user from the auth token like every other Convex write; member-gated.

## 8. Component / module boundaries

- `src/lib/import/{prompt,tool,types,validate,client}.ts` — pure prompt + tool schema + result validation + thin Anthropic client (parallels `src/lib/enrichment/`).
- `src/lib/import/assemble.ts` — pure: draft assembly + the deterministic macro computation reused live by the form.
- `src/app/actions/import-actions.ts` — `importRecipe(blurb)` (rate-limit + Claude + assemble) and `publishRecipe(draft)` (create/enrich + write + cover) + `editRecipeText`.
- `convex/imports.ts` — the per-user/day rate-limit table + mutation/query.
- `src/app/(site)/submit/page.tsx` + `src/components/import-review.tsx` (+ small leaf components: ingredient row, tag select) — the paste + review UI.
- `src/components/recipe-edit-form.tsx` — the trimmed text-edit form (replaces the create path of `recipe-form.tsx`).

## 9. What gets retired / replaced

- **`/recipe/new`** (manual create) → replaced by **`/submit`**; the home "New recipe" link points to `/submit`.
- **`recipe-form.tsx`** create + manual ingredient-editing path → retired; the edit page uses `recipe-edit-form.tsx`.
- **`saveRecipe`'s create path** → superseded by `publishRecipe`; the text-edit path becomes `editRecipeText`. (Net: exactly one create path — the pipeline.)

## 10. Sub-plan decomposition (built in order, each TDD-for-logic + behavior-tests-for-UI, per-phase commit + `/code-review`)

- **4a — Import pipeline backend.** `src/lib/import/*` (prompt + recipe tool + types + validate + client, Haiku→Sonnet), `assemble.ts` (catalog mapping + deterministic macros), `importRecipe` action, `convex/imports.ts` rate limit. *TDD.*
- **4b — Submit + review + publish.** `/submit` page + `import-review` form (live macro recompute, catalog typeahead, tag select, optional cover upload), `publishRecipe` (create + `getOrCreateEnrichedIngredient` + async Sanity cover gen). Retire `/recipe/new`; repoint the home link.
- **4c — Edit / re-import + retire manual form.** `recipe-edit-form` + `editRecipeText`, the "Re-import" flow (republish same id), remove the old `recipe-form` create/ingredient path, cover-gen polish (in-progress/empty state).

## 11. Testing

Structured-output conformance + draft parsing/validation (mock Claude); catalog mapping (reuse vs create); macro math (grams×per-100g → base vs full, `unparsedLines`) + **live recompute** on optional/quantity edits; publish → correct Sanity doc shape + ingredient refs + tag refs; `editRecipeText` text-only path; re-import republishes the same id; rate-limit enforced (cap + reset); auth gating on all actions; cover generation **fired with the right args** (Agent Actions call mocked). Full gate per sub-plan: `npm test` + `npm run lint` + `npx tsc --noEmit` + `npx convex dev --once`.

## 12. Non-goals / deferred

- **Web research of quantities** (the local pipeline studied 2–3 published recipes per import) — v1 relies on Claude's single-call best-effort estimate; the review step + macro range make corrections easy. Research-augmented import is a later enhancement.
- **fal.ai / alternative image models** — covers stay on Sanity Agent Actions (the spec's named "later" swap is deferred; the `generateCover` call is isolated so it's swappable).
- **Storing per-ingredient nutrients on the catalog or recipe** — nutrients come from the import call each time (keeps consumed-grams context recipe-specific); live recompute happens only in the in-memory draft, post-publish ingredient changes go through re-import.
- **Production deploy env** — setting `ANTHROPIC_API_KEY` + `SANITY_API_WRITE_TOKEN` on the prod deployment is an owner deploy chore; doesn't block building or local use.
- Bulk import, URL/photo import, multi-language — out of scope.
