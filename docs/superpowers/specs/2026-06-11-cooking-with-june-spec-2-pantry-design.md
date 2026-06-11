# Spec 2 — Pantry / Grocery / Plan + the kitchen loop (Convex)

**Status:** design approved, ready for implementation planning.
**Branch:** `design/app-overhaul-spec`. **Convex dev deployment:** `perfect-fennec-845`.
**Parent spec:** [2026-06-11-cooking-with-june-overhaul-design.md](./2026-06-11-cooking-with-june-overhaul-design.md) §5.

This document is the detailed design for **Spec 2** of the app overhaul. Spec 1
(Foundation: Convex Auth, households, ratings/recipe-state in Convex) is complete.
Spec 2 moves the plan / pantry / grocery list off the single global Sanity
`mealPlan` document onto **per-household Convex**, and adds the
**buy → cook → deplete → re-need** loop with real quantities.

## 1. Goal

One normalized ingredient system everywhere, real quantities, correct optional
handling, and the buy → cook → deplete → re-need loop — all per-household in
Convex, with the gram math living in tested pure functions.

## 2. Scope & guiding constraints

- **Backend-only.** Build the Convex data layer, the pure conversion/loop logic,
  the orchestration server actions, the enrichment pass, and the migration. Do
  **not** rewire the existing plan UI ([plan-view.tsx](../../../src/components/plan-view.tsx))
  — the Plan / Shop / Pantry **UX redesign is Spec 3**.
- The app is **not deployed until all overhaul specs land**, so transitional
  breakage of the old plan page is acceptable. The old Sanity `mealPlan` doc +
  [plan-actions.ts](../../../src/app/actions/plan-actions.ts) + `plan-view.tsx`
  are left untouched here and **retired in Spec 3**.
- **Do not write code that Spec 3 will throw away**, and shape the Convex API +
  pure lib so Spec 3 can consume them cleanly.
- **Reuse before building.** The gram math extends the existing tested
  [src/lib/macros](../../../src/lib/macros) lib. Convex patterns mirror
  [convex/recipeState.ts](../../../convex/recipeState.ts) and
  [convex/lib/auth.ts](../../../convex/lib/auth.ts) (`requireMembership` /
  `getMembership`). Server-merge follows the pattern in
  [src/app/(site)/page.tsx](../../../src/app/(site)/page.tsx).

### Exception to backend-only

The home/browse **"cookable now / missing ≤N" filter** is live UI today and is
backed by id-set logic in [src/lib/pantry.ts](../../../src/lib/pantry.ts). Spec 2
makes cookability **quantity-aware**, which supersedes that logic, so the
filtering + sorting is **rewired to the server-side quantity-aware version in
Spec 2c**. This is the one current-UI touch in Spec 2 (approved), to avoid two
competing definitions of "cookable" existing transiently.

## 3. Locked design decisions (resolved during brainstorming)

| Decision | Choice |
|---|---|
| Stock metadata on catalog ingredients | **Full Claude-API enrichment pass** (Phase 0 / Spec 2a) — pulls Spec 4's Claude infra forward |
| Transitional plan UI | **Backend-only**; old Sanity plan UI retired in Spec 3 |
| Existing data | **Migrate** planned recipes + pantry (pantry seeded at restock defaults) → emit a **review list** for owner corrections |
| Gram-conversion source of truth | **Stored per-ingredient metadata, name-heuristic fallback** |
| Grocery "need" amounts | **Computed** (plan × scale − pantry); only manual adds + skips are stored |
| "Skip" an ingredient | Single button; persists one `skip` marker; **auto-clears** when need returns to 0 |
| Cook | Removes the recipe from the plan; depletes required + **the optionals you select** |
| Cookable filter | **Server-side, quantity-aware**; supersedes `pantry.ts` id-set logic |

## 4. Decomposition into sub-plans

Each sub-plan is its own TDD cycle → per-phase commit → `/code-review` → address
findings. Security review is deferred to the final phase of the whole overhaul
(owner's call).

1. **Spec 2a — Catalog stock-metadata + Claude enrichment** (Phase 0 prerequisite).
2. **Spec 2b — Pure conversion + loop logic** (`src/lib`, no Convex).
3. **Spec 2c — Convex tables + mutations + queries + cookable rewire** (the loop).
4. **Spec 2d — Migration + review-list.**

Order matters: the testable math (2b) is locked before the stateful Convex layer
(2c) consumes it; migration (2d) runs last, once both tables and enrichment exist.

---

## 5. Spec 2a — Catalog stock-metadata + Claude enrichment

### Sanity `ingredient` schema additions

```
canonicalUnitKind : "mass" | "volume" | "count"   // how the ingredient is fundamentally measured
density           : number   // g/ml; meaningful for volume-kind (e.g. flour 0.53)
avgUnitGrams      : number   // grams per item; meaningful for count-kind (e.g. egg 50)
restockQuantity   : { quantity: number, unit: string }  // "a typical purchase" (e.g. 1 dozen, 5 lb)
category          : ...existing + "nonfood"        // nonfood ⇒ excluded from cookable filter
```

All fields are **optional at the schema level** so existing docs stay valid before
enrichment runs. The enrichment pass populates them for every ingredient; they are
editable in Sanity Studio, and `restockQuantity` is household-overridable at runtime
(`pantryItems.restockOverride`).

### Enrichment script

A **run-once-by-owner** admin pass (a `scripts/` entry or a guarded route — **not**
in the user flow):

- Reads all `ingredient` docs lacking metadata (idempotent; `--force` re-runs).
- Calls the **Claude API** with:
  - **Structured output** = the metadata schema above (so output is validated, not parsed).
  - A **cached system block** holding the classification rules ("classify unit kind,
    estimate density / avg-unit-grams, choose a typical restock purchase, flag
    nonfood"), seeded with the existing [units.ts](../../../src/lib/macros/units.ts)
    tables as ground-truth examples so model output stays consistent with the
    heuristic fallback.
  - Default model **Claude Haiku 4.5**, **Sonnet 4.6** as a quality fallback.
- Writes results back via `@sanity/client`.
- Owner reviews / corrects values in Studio afterward.

**Confirm current Anthropic SDK + structured-output + prompt-caching usage via
context7 before writing this script** (don't rely on memory of the API).

**Dependency:** requires `ANTHROPIC_API_KEY` on the environment (server-side only).
The agent cannot write `.env*` files — the owner sets this when 2a begins.

### Testing (2a)

Structured-output schema conformance, idempotency / skip-already-enriched,
fallback seeding consistency with `units.ts`.

---

## 6. Spec 2b — Pure conversion + loop logic (`src/lib`)

The heart of the spec, fully unit-tested in isolation before any Convex code
consumes it. New pure module(s) under `src/lib` (e.g. `src/lib/kitchen/`),
extending `src/lib/macros`.

### Gram conversion (stored-pref, heuristic fallback)

Convert an ingredient line (`quantity`, `unit`, ingredient metadata) to a canonical
amount:

- **Prefer** the ingredient's stored `canonicalUnitKind` + `density` / `avgUnitGrams`.
- **Fall back** to the name-substring heuristics in
  [units.ts](../../../src/lib/macros/units.ts) (`densityFor`, `countWeightFor`) when
  a stored field is missing.
- Canonical amount is **grams** for mass/volume kinds and a **count** for
  count-kind ingredients; the lib tracks which via `canonicalUnitKind` so callers
  store the right thing in `pantryItems.quantityG`.
- Conversions are approximate → downstream pantry quantities are always manually
  adjustable.

### Need / grocery computation

- **Plan-derived need** per ingredient: `Σ(required grams across planned recipes ×
  scale) − pantry quantity`, surfaced only when `> 0`.
- **Smart-sum** when units match; otherwise list per recipe.
- **Optional rule:** an ingredient is optional on the grocery list **only if every
  planned recipe using it marks it optional**; any required use → required.

### Coverage / cookable computation

- A recipe is **cookable now** if pantry ≥ required amount for **every required,
  non-nonfood** ingredient.
- **Missing ≤N** = count of required (non-nonfood) ingredients with insufficient
  pantry ≤ N. Optional and nonfood ingredients never affect cookability.

### Depletion computation

- **Required** deltas for all required lines (× scale).
- **Optional** deltas only for the ingredient ids the caller says were used.
- Pantry decrements **clamp at 0** (you can't go negative).

### Testing (2b)

Stored-pref vs heuristic-fallback conversion; count-kind handling; smart-sum
same-unit vs mixed-unit; optional-only-if-every-recipe rule; required-only missing
count (the original bug); deplete deltas (required + selected optionals); cookable /
missing-≤N with nonfood excluded; clamp-at-zero round-trips.

---

## 7. Spec 2c — Convex tables, mutations, queries, cookable rewire

### Tables (per-household; mirror `recipeState`)

```ts
planRecipes  {
  householdId, recipeId (string), scale (number), addedAt (number)
}  .index("by_household", ["householdId"])
   .index("by_household_recipe", ["householdId","recipeId"])

pantryItems  {
  householdId, ingredientId (string), quantityG (number),
  restockOverride? { quantity (number), unit (string) },
  updatedAt (number)
}  .index("by_household", ["householdId"])
   .index("by_household_ingredient", ["householdId","ingredientId"])

groceryItems {
  householdId, ingredientId (string),
  source: "manual" | "skip",          // manual = hand-added need (+) ; skip = suppress a plan need (−)
  manualQuantity? { quantity (number), unit (string) },  // manual rows only
  addedByUserId (Id<"users">), createdAt (number)
}  .index("by_household", ["householdId"])
   .index("by_household_ingredient", ["householdId","ingredientId"])
```

- `recipeId` / `ingredientId` are **Sanity `_id` strings** (same convention as
  `recipeState.recipeId`). Convex = mutable state; Sanity = immutable catalog.
- `quantityG` holds grams for mass/volume kinds and a count for count-kind
  ingredients.
- **Uniqueness** is enforced at write time in each upsert (query the by-pair index
  first), exactly as `recipeState` does — Convex indexes don't hard-enforce
  uniqueness. This makes duplicate pantry/grocery entries structurally impossible.
- One `groceryItems` row per ingredient: an ingredient is either a manual add or a
  skip, never both.

### The grocery / "need" model

The grocery list shown =
**(computed plan needs − skipped ingredients) ∪ manual rows.**

- Plan needs and their amounts are **computed** (§6) — never materialized — so
  **re-need is automatic**: cook depletes pantry → the shortfall recomputes → the
  ingredient reappears. No sync step, no stale rows.
- `groceryItems` therefore stores only **manual** additions and **skip** markers.

### The kitchen loop (orchestration)

Convex cannot read Sanity, so a **server layer** (server actions, following the
server-merge pattern) fetches Sanity recipe/ingredient content, computes deltas with
the 2b pure lib, and calls Convex mutations to persist. Mutations stay transactional
and apply **given** amounts; they never trust client-supplied quantities except for
explicit manual pantry adjustments. `requireMembership` guards every mutation/query.

- **Plan:** `addToPlan(recipeId, scale)` / `removeFromPlan(recipeId)` /
  `setScale(recipeId, scale)` — `planRecipes` upserts (unique guard). No grocery
  seeding (needs are computed).
- **Buy** (`markBought(ingredientId)`): server resolves effective restock
  (`restockOverride ?? catalog.restockQuantity`) → grams → mutation adds to
  `pantryItems.quantityG` (upsert) and deletes a `manual` grocery row if present.
  Plan-derived items fall off the recomputed list automatically.
- **Cook** (`cook(recipeId, usedOptionalIngredientIds: string[])`): server computes
  required deltas (all required lines × scale) + optional deltas for **only** the
  passed ingredient ids; **one mutation** then atomically (a) decrements pantry
  (clamp ≥ 0), (b) increments `recipeState.madeCount` + sets `lastMadeAt`,
  (c) **removes the recipe from `planRecipes`**, (d) cleans up `skip` rows whose
  need is now 0. The "which optionals did you use?" multi-select is a Spec 3 UI
  concern; the backend takes the list.
- **Re-need:** not a mutation — inherent in the computed list.
- **Pantry adjust:** `setPantryQuantity(ingredientId, quantityG)` /
  `setRestockOverride(ingredientId, restock?)` — manual correction (conversions are
  approximate).
- **Manual grocery:** `addManualItem(ingredientId, manualQuantity)` /
  `removeManualItem(ingredientId)` / `skip(ingredientId)` / `unskip(ingredientId)`
  — all `groceryItems` upserts keyed by catalog ingredientId (no free-text path).

### Skip lifecycle

- `skip(ingredientId)` writes a `skip` row → the ingredient drops off and stays off
  while the recipe stays planned and pantry stays short (supports substitutions —
  e.g. skip red cabbage, cook with green).
- A `skip` row **auto-clears when the ingredient's computed need returns to 0**
  (recipe unplanned or pantry stocked), so a future plan needing it surfaces it
  fresh. Cleanup runs in the mutations that can change need (`cook`,
  `removeFromPlan`, `markBought`, pantry adjusts): recompute affected ingredients'
  needs server-side and delete now-stale skips. No manual skip-state management.

### Cookable rewire (the one UI touch)

Replace the id-set `filterCookable` / `missingFromPantry` in
[src/lib/pantry.ts](../../../src/lib/pantry.ts) with the quantity-aware computation
(§6), run **server-side**: join Sanity recipe lines + ingredient metadata with the
household's Convex `pantryItems`, then filter + sort by missing-required count.
One conversion path everywhere.

### Testing (2c)

Unique-index dedup (pantry/grocery); `requireMembership` gating; buy → pantry;
cook → deplete + `madeCount` + unplan + skip-cleanup (atomic); skip suppress +
auto-clear; manual add/remove; pantry adjust; server-side cookable/missing-≤N
join behavior.

---

## 8. Spec 2d — Migration + review-list

A **one-time, owner-run** migration reads the global Sanity `mealPlan` doc and
writes the founder's household Convex rows. Idempotent.

- **Planned recipes** → `planRecipes` (recipeId + scale from `recipeScales`,
  default 1).
- **Pantry ids** → `pantryItems` rows seeded at each ingredient's effective
  `restockQuantity` → grams (the interpolation). Ids that don't resolve to a catalog
  ingredient are skipped (and reported).
- **Grocery ids** → **not** migrated (computed needs re-derive them).
- **Manual free-text items** → name-matched to a catalog ingredient where possible
  (→ `manual` `groceryItems`); **unmatched ones go in the review list**, never
  silently dropped.

### Review list

Emitted (file / console) for the owner to go over:

- Every seeded pantry item: ingredient name + assumed quantity (e.g.
  `eggs — 12 (1 dozen)`).
- Every unmapped manual item (e.g. `grandma's special sauce — no catalog match`).

The owner returns corrections, applied via a small follow-up mutation/script.

### Testing (2d)

Recipe + scale carryover; pantry seed at restock; unmapped-item reporting;
idempotency.

---

## 9. Build order & dependencies

```
Spec 1 (done)
  └─ 2a  catalog metadata + enrichment   (needs ANTHROPIC_API_KEY)
       └─ 2b  pure conversion + loop logic
            └─ 2c  Convex tables + mutations + queries + cookable rewire
                 └─ 2d  migration + review-list   (needs 2a data + 2c tables)
```

Spec 3 (UX) consumes the 2c Convex API + queries and retires the old Sanity plan
UI. Spec 4 (import pipeline) reuses the 2a Claude infra to assign stock metadata to
new ingredients.

## 10. Risks & notes

- **Conversion accuracy** is approximate by design; pantry is always manually
  adjustable and the migration emits a review list — accuracy is a UX affordance,
  not a correctness guarantee.
- **Skip auto-clear** depends on recomputing affected needs inside mutations; tests
  must cover the unplan / stock-up → skip-cleared paths.
- **Enrichment cost** is pennies (cached Haiku); the pass is owner-run and idempotent.
- **Transitional breakage** of the old plan page is expected and accepted until
  Spec 3.
