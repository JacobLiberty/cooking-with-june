# Macros Tracker — Implementation Plan

> Status: **PLAN ONLY** — no feature code has been written. This document grounds the
> design in the existing Cooking with June codebase and the current (2026) USDA
> FoodData Central API. Reviewed against `recipe.ts`, `ingredient-line.ts`,
> `ingredient.ts`, `queries.ts`, `types.ts`, `recipe-actions.ts`, `recipe-form.tsx`,
> `recipe-ingredients.tsx`, the recipe detail page, `write-client.ts`, and `env.ts`.

## Overview

Add per-serving **calories, protein, carbohydrate, and fat** to recipes, shown on the
recipe detail page (and optionally recipe cards / meal-plan rollup).

Recommended approach in brief: **store computed macros as cached fields on the recipe
document** (computed once, never recomputed on page load), with an **"estimated" flag**.
Phase 1 ships the schema + display + manual entry so the feature is usable immediately
with zero external dependencies. Phase 2 adds a **server-side auto-compute** flow that
maps each ingredient line's free-text quantity to grams, looks up per-100g nutrition
from the USDA FoodData Central API (cached on the `ingredient` document so each
ingredient is fetched at most once), sums, divides by servings, and writes the result
back to the recipe. Phase 3 rolls macros up across a meal plan.

The honest hard problem is **quantity parsing**: ingredient quantities are free text
(`"1"`, `"1/2"`, `"2-3"`, `"a handful"`, `"to taste"`) with unit strings (`"cup"`,
`"tbsp"`, `"lb"`). Converting these to the grams the USDA API needs is inherently
approximate. The plan addresses this with a units→grams table, density approximations
for volume units, and explicit "skip / flag unparseable" behavior — and is candid that
results are estimates, not nutrition-label-grade values.

This reuses existing patterns wherever possible and **adds no new runtime dependencies**:
the USDA client is a thin `fetch` wrapper, parsing/summing are pure functions tested with
the existing `vitest` setup, and writes go through the existing `getWriteClient()`.

---

## USDA FoodData Central API summary (verified June 2026)

- **Base URL:** `https://api.nal.usda.gov/fdc/v1`
- **Food search endpoint:** `GET /foods/search?query=<term>&api_key=<KEY>`
  (supports `dataType`, `pageSize`, `pageNumber`).
- **Food detail endpoint:** `GET /food/{fdcId}?api_key=<KEY>`
  (optional `nutrients=<n>,<n>` to limit returned nutrient numbers).
- **Authentication:** a free **api.data.gov** API key, passed as the `api_key` query
  parameter on every request. There is no OAuth/header scheme.
- **`DEMO_KEY`:** exists for quick exploration, but is heavily throttled
  (**30 requests/hour and 50 requests/day per IP**). Fine for a manual smoke test,
  not for batch-computing 18 recipes. Register a real key.
- **Rate limit (registered key):** **1,000 requests/hour per IP** (default api.data.gov
  ceiling). Every response carries `X-RateLimit-Limit` and `X-RateLimit-Remaining`
  headers — read these to back off. 18 recipes × ~8 ingredients ≈ 144 lookups, well
  under the hourly ceiling even before ingredient-level caching.
- **dataType values:** `Foundation`, `SR Legacy`, `Survey (FNDDS)`, `Branded`.
  - **Recommended for this app: prefer `Foundation`, then fall back to `SR Legacy`.**
    These are generic, lab-analyzed whole foods ("Beef, ground, raw"; "Onions, raw")
    keyed per 100 g — exactly what generic cooking ingredients map to. Avoid `Branded`
    (specific commercial products, noisy for generic names) and `Survey (FNDDS)`
    (prepared-dish composites) for ingredient-level lookups. Request with
    `dataType=Foundation,SR%20Legacy` and take the top hit, or apply a name-similarity
    tiebreak.

### Nutrient JSON shape (how to extract the four macros)

A food-detail response contains a `foodNutrients` array. Each entry exposes a nutrient
descriptor (`nutrient.number` / `nutrient.name` / `nutrient.unitName`) and an `amount`.
**All Foundation / SR Legacy nutrient amounts are per 100 g of the food.** Extract by
USDA nutrient **number** (stable across datasets — prefer numbers over names):

| Macro                | Nutrient number | Name                          | Unit  |
| -------------------- | --------------- | ----------------------------- | ----- |
| Calories (energy)    | `208`           | Energy                        | kcal  |
| Protein              | `203`           | Protein                       | g     |
| Total fat            | `204`           | Total lipid (fat)             | g     |
| Total carbohydrate   | `205`           | Carbohydrate, by difference   | g     |

Notes:
- The shape differs slightly between the search response (`foodNutrients[].nutrientNumber`
  / `value`) and the detail response (`foodNutrients[].nutrient.number` / `amount`). The
  extractor must read **detail** responses (richer, authoritative) and tolerate both
  shapes defensively.
- Energy occasionally appears twice (kcal and kJ); filter on `unitName === "KCAL"`.
- All amounts are per 100 g → grams of ingredient ÷ 100 × per-100g amount = contribution.

**Cited sources:**
- USDA FoodData Central API Guide — https://fdc.nal.usda.gov/api-guide/
- API key signup — https://fdc.nal.usda.gov/api-key-signup/
- OpenAPI spec — https://fdc.nal.usda.gov/api-spec/fdc_api.html
- api.data.gov developer manual (rate limits / DEMO_KEY) — https://api.data.gov/docs/developer-manual/

---

## Data model

The app **hand-maintains** TypeScript types in `src/sanity/types.ts` (no codegen), so
every schema change below must be mirrored there manually.

### 1. Per-recipe cached macros (Phase 1)

Add a `macros` object field to `src/sanity/schemaTypes/documents/recipe.ts`. Per **serving**,
computed once and cached — never recomputed on page load:

```ts
defineField({
  name: "macros",
  title: "Nutrition (per serving)",
  type: "object",
  fields: [
    { name: "calories", title: "Calories (kcal)", type: "number" },
    { name: "protein",  title: "Protein (g)",     type: "number" },
    { name: "carbs",    title: "Carbohydrate (g)", type: "number" },
    { name: "fat",      title: "Total fat (g)",    type: "number" },
    { name: "estimated", title: "Estimated", type: "boolean",
      description: "Auto-computed from USDA data; treat as approximate." },
    { name: "computedAt", title: "Computed at", type: "datetime" },
    { name: "source", title: "Source", type: "string",
      options: { list: ["usda", "manual"] } },
    // Lines we couldn't convert to grams, surfaced so the user knows what was skipped.
    { name: "unparsedLines", title: "Skipped ingredients", type: "array",
      of: [{ type: "string" }] },
  ],
}),
```

Mirror in `types.ts`:

```ts
export type RecipeMacros = {
  calories?: number; protein?: number; carbs?: number; fat?: number;
  estimated?: boolean; computedAt?: string; source?: "usda" | "manual";
  unparsedLines?: string[];
};
```
…and add `macros?: RecipeMacros` to `RecipeDetailData`, `RecipeCardData` (if shown on
cards), and `RecipeEditData` (for manual entry). Project it in `RECIPE_QUERY`,
`RECIPES_QUERY`, and `RECIPE_EDIT_QUERY` in `queries.ts`, e.g.:

```groq
macros{ calories, protein, carbs, fat, estimated, source }
```

### 2. Per-ingredient nutrition cache (Phase 2)

To enable recomputation without re-hitting USDA, cache the USDA result on the
`ingredient` document (`src/sanity/schemaTypes/documents/ingredient.ts`). Because
ingredients are shared references across recipes, **one lookup serves every recipe** that
uses it — and persists across recompute runs:

```ts
defineField({
  name: "nutrition",
  title: "Nutrition (per 100 g, from USDA)",
  type: "object",
  fields: [
    { name: "fdcId", type: "number", title: "USDA FDC id" },
    { name: "fdcDescription", type: "string", title: "USDA match" }, // for auditing
    { name: "caloriesPer100g", type: "number" },
    { name: "proteinPer100g",  type: "number" },
    { name: "carbsPer100g",    type: "number" },
    { name: "fatPer100g",      type: "number" },
    { name: "fetchedAt", type: "datetime" },
  ],
}),
```

**Recommendation:** yes, store per-ingredient nutrition. It is the single most valuable
cache in the design — it makes recompute cheap, keeps us far under rate limits, lets a
human eyeball/override a bad USDA match (`fdcDescription` is the audit trail), and decouples
recipe macros from live API availability. Recipe macros remain the cached display value;
ingredient nutrition is the recomputation source of truth.

---

## Quantity → grams strategy

This is the accuracy-limiting step. Be explicit that output is **estimated**.

**Inputs per ingredient line:** `quantity` (free-text string), `unit` (free-text string),
and the resolved ingredient `name`. Reuse the existing numeric parser in
`src/lib/scale.ts` (`parseNum` handles whole / decimal / `"1/2"` / `"1 1/2"` / ranges) —
extract/share it rather than re-implementing.

Proposed pure module `src/lib/macros/quantity-to-grams.ts`:

1. **Parse the quantity number.** Reuse `scale.ts` logic. For ranges (`"2-3"`) take the
   **midpoint**. If no number parses (`"a handful"`, `"to taste"`, `""`) → **unparseable**.
2. **Normalize the unit** (lowercase, strip trailing `s`, map aliases: `tbsp`/`tablespoon`,
   `tsp`/`teaspoon`, `oz`/`ounce`, `lb`/`pound`, `g`/`gram`, `kg`, `ml`, `l`, `cup`, etc.).
3. **Convert to grams** via a constants table (no new dependency — a hand-maintained
   `UNIT_GRAMS` map):
   - **Mass units are exact:** `g`=1, `kg`=1000, `oz`=28.35, `lb`=453.6.
   - **Volume units need density.** Water-baseline approximations (`tbsp`≈15 ml,
     `tsp`≈5 ml, `cup`≈240 ml, `ml`=1 g) with a small **per-ingredient density table**
     for common cases (flour ≈0.53 g/ml, sugar ≈0.85, oil ≈0.92, butter ≈0.96, honey
     ≈1.42, rice ≈0.85). Unknown ingredient in a volume unit → water density (1 g/ml)
     with a logged caveat.
   - **Count units** (`""` unit with a number, or `"clove"`, `"egg"`, `"slice"`) need a
     per-ingredient average-weight table (egg ≈50 g, garlic clove ≈5 g, medium onion
     ≈110 g). Unknown count → **unparseable** (don't guess wildly).
4. **Skip optional ingredients?** Decision to confirm with the user: I recommend
   **including** optional ingredients in macros (they're usually eaten) but this is a
   product call — see Open questions.
5. **Output:** `{ grams: number } | { unparseable: true; reason: string }`. Unparseable
   lines are collected into `macros.unparsedLines` and force `estimated = true`.

**Accuracy honesty:** mass units are accurate; volume-of-solids and counts are rough
(±20–40% per line is realistic). Recipe-level totals partially average out per-line error,
but these are **ballpark figures**, always labeled "estimated." This is acceptable for a
home recipe app; it is not a substitute for a nutrition label.

---

## Compute flow (Phase 2)

Two interchangeable entry points; both share the same pure core so logic is tested once.

**Pure core (`src/lib/macros/`, all unit-tested):**
- `quantity-to-grams.ts` — line → grams (above).
- `extract-nutrients.ts` — USDA detail JSON → `{ caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g }` by nutrient number 208/203/204/205.
- `sum-macros.ts` — given `[{ grams, per100g }]` → recipe total → ÷ servings → per-serving `RecipeMacros`, plus the list of skipped lines and the `estimated` flag.

**Thin I/O layer (impure, mocked in tests):**
- `src/lib/macros/usda-client.ts` — `searchFood(name, dataType)` and `getFood(fdcId)`,
  reading `process.env.USDA_API_KEY`, server-only. Reads `X-RateLimit-Remaining` and
  throttles (small delay / stop) when low. Validates/normalizes the response at the
  boundary (per the repo's input-validation rules) before handing to the pure extractor.

**Orchestration — a server action in `src/app/actions/macros-actions.ts`** (mirrors the
existing `recipe-actions.ts` patterns: `"use server"`, `requireEditor()`, `assertRecipe()`,
`getWriteClient()`, `revalidatePath`):

```
computeRecipeMacros(recipeId):
  requireEditor(); assertRecipe(recipeId)
  load recipe ingredient lines (quantity, unit, ingredient ref + name + cached nutrition)
  for each line:
    grams = quantityToGrams(line)        // skip + flag if unparseable
    per100 = line.ingredient.nutrition   // use cache if present
    if missing:
      hit = usda.searchFood(name, "Foundation,SR Legacy")  // top match
      detail = usda.getFood(hit.fdcId)
      per100 = extractNutrients(detail)
      write.patch(ingredientId).set({ nutrition: { ...per100, fdcId, fetchedAt } })
  totals = sumMacros(lines); perServing = totals / (servings ?? 1)
  write.patch(recipeId).set({ macros: { ...perServing, estimated, source:"usda",
                                        computedAt: now, unparsedLines } })
  revalidatePath(...)
```

Plus a **one-off backfill script** (e.g. `scripts/compute-all-macros.mjs`, modeled on the
existing root `import-recipes.mjs`) that iterates all recipes and calls the same core,
with a deliberate delay between USDA calls to respect the rate limit. Good for the
initial 18-recipe backfill.

**Caching guarantees:** recipe `macros` is read straight from the recipe doc on page load
(no API call ever on render). Ingredient `nutrition` is fetched at most once per
ingredient, ever, unless explicitly recomputed.

---

## UI

- **Recipe detail page** (`src/app/(site)/recipe/[slug]/page.tsx`): add a small "Nutrition
  (per serving)" block near the header meta row or above Ingredients — four figures
  (Calories / Protein / Carbs / Fat) using the existing `kicker` / `text-ink-soft`
  styling, plus an **"estimated" pill** when `macros.estimated`. Render nothing if
  `macros` is absent. A new small server-safe component `src/components/recipe-macros.tsx`.
- **Recipe cards** (optional, Phase 1+): show calories/serving only, to avoid clutter.
  Requires projecting `macros.calories` into `RECIPES_QUERY` + `RecipeCardData`.
- **Edit form** (`src/components/recipe-form.tsx`): Phase 1 manual-entry inputs (four
  number fields) wired through `saveRecipe` in `recipe-actions.ts`, setting
  `macros.source = "manual"`, `estimated = false`. Phase 2 adds a "Recompute from USDA"
  button calling `computeRecipeMacros`.
- **Estimated label:** wherever macros show and `estimated === true`, render an "≈ estimated"
  affordance with a tooltip/aside explaining values are approximated from USDA data and
  some lines may have been skipped (list `unparsedLines`).
- **Meal-plan rollup** (Phase 3): sum each planned recipe's per-serving macros × planned
  scale on the meal-plan page; "estimated" if any contributing recipe is estimated.

---

## Phased rollout

**Phase 1 — Schema + display + manual entry (no external dependency).**
`macros` field on recipe + `types.ts` + GROQ projections; detail-page display with
estimated pill; manual-entry inputs in the edit form via `saveRecipe`. Ships value
immediately; no API key required.

**Phase 2 — USDA auto-compute.**
`ingredient.nutrition` cache field; `src/lib/macros/*` pure modules (TDD); `usda-client.ts`;
`computeRecipeMacros` server action + backfill script; "Recompute from USDA" button;
`unparsedLines` surfacing. Requires `USDA_API_KEY`.

**Phase 3 — Meal-plan totals.**
Per-serving × planned-scale rollup on the meal-plan view, with aggregate estimated flag.

---

## Testing strategy

Follows the repo convention: pure functions are TDD'd with `vitest`; the I/O client is
mocked. New tests live beside their modules (`*.test.ts`), matching `src/lib/scale.test.ts`.

- **`quantity-to-grams.test.ts`** — mass exact (`"1 lb"`→453.6); volume w/ density
  (`"1 cup"` flour vs water); ranges→midpoint (`"2-3 cups"`); counts (`"2 eggs"`→100 g);
  unparseable (`"a handful"`, `"to taste"`, `""`) flagged; unit aliases (`tbsp`/`tablespoon`).
- **`extract-nutrients.test.ts`** — pull 208/203/204/205 from a realistic `foodNutrients`
  fixture; pick KCAL energy not kJ; tolerate both search/detail shapes; missing nutrient → undefined.
- **`sum-macros.test.ts`** — summing + ÷ servings; `estimated` true when any line skipped;
  `unparsedLines` populated; zero/undefined servings guarded.
- **`computeRecipeMacros`** — server-action test mirroring `recipe-actions.test.ts`:
  **mock the USDA client and `getWriteClient`**, assert it patches ingredient `nutrition`
  on a miss, reuses the cache on a hit, writes per-serving `macros`, and enforces
  `requireEditor` / `assertRecipe`.
- Target the repo's 80% coverage bar on the new pure modules.

---

## Security

- **API key:** `USDA_API_KEY`, **server-only** (no `NEXT_PUBLIC_` prefix — that would ship
  it to the browser). Read only inside `usda-client.ts` / the backfill script, never in a
  client component. Mirror the `getWriteClient()` pattern: read from `process.env` lazily
  and throw a clear `"Missing USDA_API_KEY"` if absent, so the build doesn't require it.
- **User must create the env entry themselves** — per project memory, the assistant cannot
  write `.env*` files. The user adds `USDA_API_KEY=...` to `.env` (and a documented line in
  `.env.example`). See the setup guide below.
- **Authorization:** `computeRecipeMacros` must call `requireEditor()` and `assertRecipe()`
  exactly like the other recipe mutations, so only editors can trigger writes/spend quota.
- **Boundary validation:** validate/normalize USDA responses before use (don't trust
  external JSON shape); fail closed (skip the line, flag estimated) rather than throwing on
  a malformed food.
- **No new dependencies** without your approval — the plan deliberately uses `fetch` and
  hand-written tables to avoid one. (If you'd prefer a Zod schema for the USDA response,
  Zod is *not* currently in `package.json` and would need approval.)

---

## API key setup guide (USDA FoodData Central)

Beginner-friendly, step by step.

1. **Go to the signup page:** https://fdc.nal.usda.gov/api-key-signup/
   (This is the official USDA FoodData Central key request form, powered by api.data.gov.)
2. **Fill in the short form:** First name, Last name, Email. (Some fields like "how you'll
   use it" are optional — a one-liner like "personal recipe nutrition estimates" is fine.)
   Submit.
3. **Get your key:** The key is shown **on the confirmation page immediately** and is also
   **emailed** to the address you entered. It's a ~40-character string. Copy it.
4. **Add it to your local env file.** In the project root, open `.env` and add a line
   (use **your** key, no quotes, no `NEXT_PUBLIC_` prefix):
   ```
   USDA_API_KEY=PASTE_YOUR_KEY_HERE
   ```
   Also add a placeholder line to `.env.example` so the variable is documented for future
   setups:
   ```
   USDA_API_KEY=
   ```
   For production (Vercel), add the same `USDA_API_KEY` as an **Environment Variable** in
   the project settings — do **not** commit the real key.
5. **Verify it works with a quick curl** (replace `YOUR_KEY`):
   ```bash
   curl "https://api.nal.usda.gov/fdc/v1/foods/search?query=onion&dataType=Foundation&pageSize=1&api_key=YOUR_KEY"
   ```
   A JSON body with a `foods` array means the key is live. To confirm nutrient extraction,
   take an `fdcId` from that result and fetch the detail:
   ```bash
   curl "https://api.nal.usda.gov/fdc/v1/food/<FDC_ID>?api_key=YOUR_KEY"
   ```
   You should see a `foodNutrients` array containing nutrient numbers 208/203/204/205.
   You can sanity-check throttling via the `X-RateLimit-Remaining` response header
   (`curl -i ...`).
6. **Rate-limit ceiling:** a registered key allows **1,000 requests/hour per IP**. The
   `DEMO_KEY` (usable without signup) is capped at **30/hour and 50/day** — fine to eyeball
   the curl above, too low for batch compute. Computing all 18 current recipes is ~150
   lookups max (fewer with ingredient caching), comfortably within the registered ceiling.

---

## Open questions (confirm before building)

1. **Optional ingredients** — include them in macros (my recommendation) or exclude, given
   the schema already distinguishes `optional`?
2. **Cards display** — show calories on recipe cards, or keep macros only on the detail page
   to reduce clutter?
3. **Manual override vs. auto** — if an editor manually entered macros, should "Recompute
   from USDA" overwrite them, or refuse unless `source === "usda"`? (I lean: warn + require
   confirm.)
4. **USDA match quality** — auto-take the top `Foundation`/`SR Legacy` hit, or store
   `fdcDescription` and let an editor confirm/correct the mapping per ingredient before it's
   trusted? (Affects accuracy materially.)
5. **Per-ingredient density/count tables** — start with a small hand-curated table for the
   ingredients in the current 18 recipes, expanding over time? (Pragmatic and keeps scope tight.)
6. **Recompute trigger** — recompute on recipe save automatically, or only via an explicit
   button to control API spend and avoid surprise writes? (I lean explicit button.)
7. **New dependency check** — confirm we stay dependency-free (hand-rolled tables + `fetch`),
   or approve adding `zod` for USDA response validation.
