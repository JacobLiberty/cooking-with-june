# Cooking with June — App Overhaul Design

**Date:** 2026-06-11
**Status:** Approved decisions captured; pending user review of this spec
**Branch:** `design/app-overhaul-spec`

This is the master design for a multi-part overhaul. It is decomposed into **four specs** that ship in dependency order. Each spec gets its own implementation plan (via the writing-plans flow) when we build it. This document is the whole picture so we can see how the pieces fit before committing to an order.

---

## 1. Problem statement

The app is functional and visually strong, but the **authed features are confusing and inconsistent**:

- Pantry/grocery/plan are hard to manage compared to recipe ingredients, and interact badly with optional ingredients.
- Ingredients are normalized *on the recipe side only*; pantry/grocery use a parallel free-text path → **duplicates, inconsistent naming, no shared catalog reuse**.
- **No quantities** are maintained anywhere except inside recipes.
- **Optional ingredients are buggy**: a recipe with all required ingredients but a missing *optional* one still shows as "missing ingredients" on the Plan tab.
- The **Plan vs Grocery UI** is hard to read, inefficient, and invites duplication.
- There is **no concept of a household** — sign-in is a two-person email allowlist and all plan/pantry/grocery data is a single global document.
- **Adding recipes properly requires the owner + Claude locally** (normalize, macros, image). Other people can't add recipes that come out normalized.

## 2. Key findings that reframe the work

- **Recipe ingredients are already fully normalized.** Canonical `ingredient` documents with case-insensitive uniqueness; recipe lines are *references*; the recipe form already does autocomplete + create-if-missing ([recipe-form.tsx:114](../../../src/components/recipe-form.tsx#L114), [recipe-actions.ts:24-36](../../../src/app/actions/recipe-actions.ts#L24-L36)).
- **Categories already exist** on every ingredient (produce/protein/dairy/pantry/spice/other) — just never used in the grocery UI.
- **The grocery/pantry side ignores all of it**: `mealPlan` stores pantry/grocery as loose arrays of string IDs plus a separate free-text `manualItems` path ([meal-plan.ts:24-35](../../../src/sanity/schemaTypes/documents/meal-plan.ts#L24-L35)).
- **The optional bug is tiny and located**: `PLAN_QUERY` never projects `requiredIngredientIds`, so plan-view counts all ingredients (incl. optional) as missing ([plan-view.tsx:296-301](../../../src/components/plan-view.tsx#L296-L301)). The correct field already exists in the other query.
- **A unit→grams conversion lib with per-ingredient density already exists and is tested** ([src/lib/macros/](../../../src/lib/macros/)) — this is exactly what pantry depletion needs.
- **Households are genuinely impossible on Sanity**: no end-user auth (its "seats" are CMS editor seats), and a single global plan doc.

## 3. Architecture decisions (locked)

| Decision | Choice |
|---|---|
| Backend | **Hybrid: Sanity + Convex.** Sanity keeps recipe content + image pipeline; Convex owns users/households + all per-household state. |
| Recipe ownership | **Shared global cookbook.** One curated collection everyone sees; households have private state over it. |
| Auth | **Convex Auth (Google).** Retire next-auth. Convex enforces per-household access. |
| Membership | **One household per user (v1).** Multi-household + switcher deferred. |
| Invites | **Shareable invite link/code.** No email infra. |
| Curation gate | **The pipeline IS the gate.** Any member can publish to the global cookbook, but the *only way to create a recipe* is the AI normalization + macros + image pipeline. Manual free-form creation is retired. |
| Per-recipe state | **Ratings = global** (any authed user rates, everyone sees aggregate), stored in Convex. **Made-it + To-try = per-household** and exposed as browse/filter facets. **Notes = per-household.** |
| Pantry | **Real quantity tracking with auto-depletion**, seeded from per-ingredient default "restock" quantities (no bulk manual entry). Depletes on cook, including an "did you use the optional ingredients?" prompt. |
| Grocery amounts | **Smart-sum when units match**, list when they don't. |
| Non-food items | **Everything goes through the catalog**, but non-food items get a category that **excludes them from the cookable filter**. |
| Plan model | **Simple "cooking soon" set** (no calendar). |
| Authed IA | **Three sections: Plan / Shop / Pantry**, plus a **dedicated shopping mode**. |
| Filters | **Search + category facets + "cookable now" toggle** (replaces button-per-ingredient). |
| Recipe input | **Text blurb only (v1).** |
| Image gen | **Sanity `generate_image`** (already wired) for v1; swappable behind one function (fal.ai FLUX is the cheaper future option). |
| Recipe editing | **Light edits + re-normalize on ingredient changes.** Text fields editable freely; ingredient changes re-run normalization so macros/stock-metadata stay correct. |

### Data ownership principle

> **Sanity = immutable shared content. Convex = all mutable state.**

- **Sanity (global, shared):** recipe content, ingredient catalog (+ categories + new stock metadata), tags, cover images.
- **Convex (per-household, or global-but-user-attributed):** users, households, memberships, invites, pantry, grocery, plan, made-it, to-try, notes (per-household); ratings (global).

---

## 4. Spec 1 — Foundation (Auth, Households, Data split)

**Goal:** stand up Convex with Convex Auth, the household model, invites, and migrate existing data — without touching Sanity recipe content.

### Convex tables (sketch)

```
users          { authId, email, name, createdAt }                     // Convex Auth + profile
households     { name, ownerUserId, createdAt }
memberships    { userId, householdId, role: "owner"|"member", createdAt }   // unique(userId) in v1; index(householdId)
invites        { householdId, code, createdByUserId, expiresAt?, usedByUserId?, createdAt }  // index(code)
ratings        { recipeId, userId, stars, updatedAt }                 // GLOBAL; unique(recipeId,userId)
recipeState    { householdId, recipeId, madeCount, lastMadeAt?, toTry, notes? }  // unique(householdId,recipeId)
```
(pantry/grocery/plan tables are defined in Spec 2.)

### Onboarding flow
Sign in with Google → if the user has **no membership**, route to a **"Create a household / Enter an invite code"** gate. Creating makes them `owner`; joining via code makes them `member`. Owner can rename the household, generate/revoke invite links, and remove members. All members have equal rights over pantry/grocery/plan.

### Migration
- Seed one **"Jacob & Lily"** household.
- Convert current `editor` docs (Jacob, Lily) → Convex `users` + `memberships`.
- Move the global `mealPlan` (planned recipes, pantry IDs, grocery IDs, scales) into that household's Convex records (Spec 2 tables).
- Migrate existing Sanity per-recipe state → Convex: `ratings[]` → `ratings` (global), `madeCount`/`lastMadeAt` → `recipeState`, `wishlist` → `recipeState.toTry`, recipe `notes` → `recipeState.notes`.
- The legacy `editor` allowlist + `signIn` callback are retired. Sanity Studio remains the owner's content/admin tool.

### Testing
Auth gate (no-membership redirect), invite create/accept/expiry/revoke, membership uniqueness, per-household data isolation (one household cannot read another's pantry/grocery/plan), ratings global visibility.

---

## 5. Spec 2 — Pantry / Grocery / Plan data model + depletion (Convex)

**Goal:** one normalized ingredient system everywhere, real quantities, correct optional handling, and the buy→cook→deplete→re-need loop.

### Catalog changes (Sanity `ingredient` gains stock metadata)
```
canonicalUnitKind : "mass" | "volume" | "count"
density           : g/ml (for volume) ; avgUnitGrams (for count) ; mass is exact
restockQuantity   : { quantity, unit }     // default "a typical purchase" (e.g. 1 dozen, 5 lb)
category          : ...existing + "nonfood"  // nonfood ⇒ excluded from cookable filter
```
These are assigned by the **Spec 4 pipeline** for new ingredients and **backfilled for existing ingredients** by a one-time enrichment pass (see §8). Editable in Sanity Studio; restock is **household-overridable**.

### Convex tables (sketch)
```
planRecipes   { householdId, recipeId, scale, addedAt }              // unique(householdId,recipeId)
pantryItems   { householdId, ingredientId, quantityG, restockOverride?, updatedAt }  // unique(householdId,ingredientId)
groceryItems  { householdId, ingredientId, source:"plan"|"manual", manualQuantity?, checked, addedByUserId, createdAt } // unique(householdId,ingredientId)
```
Unique indexes make duplicate pantry/grocery entries **structurally impossible** (kills today's dup problem). Plan-derived "need" amounts are **computed** (smart-sum across planned recipes × scale, minus pantry); a hand-added item carries its own `manualQuantity`. When both exist for one ingredient, they combine on the row.

### Canonical quantities
Pantry stores `quantityG` (grams, or count for count-kind), converted via the existing macros lib. Display converts back to a friendly unit. Conversions are approximate → **pantry quantities are always manually adjustable.**

### Optional, redesigned (fixes the bug + confusion)
- An ingredient is **optional on the grocery list only if every planned recipe using it marks it optional.** Any required use → required.
- The Plan **"missing" badge counts required ingredients only.**
- Optional items render in a **separate "nice-to-have" group**, never silently skipped.

### The kitchen loop
- **Buy** — checking a grocery item as bought **adds its restock quantity to the pantry** and removes it from the active list.
- **Cook** — marking a planned recipe "made it" **depletes the pantry** by that recipe's *required* amounts, and **prompts "did you use the optional ingredients?"**, depleting those only if confirmed. Increments `recipeState.madeCount`.
- **Re-need** — when pantry falls below what a planned recipe requires, the ingredient **auto-surfaces on the grocery list**.
- **Grocery amounts** — smart-sum when units match; otherwise list per-recipe.

### Cookable filter logic
A recipe is "cookable now" if the pantry has ≥ required amount for **every required (non-nonfood) ingredient**. "Missing ≤N" counts required ingredients with insufficient pantry. Non-food ingredients never affect cookability.

### Testing
Dedup via unique index, gram conversion round-trips, optional-grouping rule, missing-required computation (the bug), deplete-on-cook with/without optional confirmation, restock-on-buy, re-need surfacing, cookable/missing-≤N computation.

---

## 6. Spec 3 — Plan / Shop / Pantry UX redesign

**Goal:** replace the 451-line god-component ([plan-view.tsx](../../../src/components/plan-view.tsx)) with three focused, well-bounded views + a shopping mode + scalable filters.

- **Plan** — the "cooking soon" set: recipe rows with serving scale, a **required-only** missing badge, and a **Cook / Made-it** action (drives depletion).
- **Shop** — the derived grocery list **grouped by store-category** (Produce → Dairy → Protein → Pantry → Spice → Non-food), with an **optional / nice-to-have group** at the bottom. Add-item uses the **same catalog autocomplete + create-if-missing** as the recipe form (no more free-text path).
- **Pantry** — your stock with quantities, manual adjust, restock defaults visible/overridable.
- **Shopping mode** — a focused, large-touch-target, mobile-first view: category-grouped, big check-off, progress indicator, optional group separated. Honors `prefers-reduced-motion` per [PRODUCT.md](../../../PRODUCT.md).
- **Filter rework** — typeahead ingredient search (add a few to filter by) + collapsible category facets + a pantry-aware **"cookable now / missing ≤N" toggle**. Scales to a large catalog.

**Visual design** (terracotta editorial treatment, type hierarchy, motion) is executed at build time with the `frontend-design` / `i-impeccable` skills and a visual mockup pass — this spec fixes only the **information architecture and behavior**.

### Testing
Component-level: required-only missing badge, category grouping + ordering, optional group placement, autocomplete reuse (no dup creation), shopping-mode check-off → pantry, filter facet + cookable toggle behavior.

---

## 7. Spec 4 — Self-serve recipe import pipeline

**Goal:** any signed-in member can add a recipe that comes out **equally normalized, with macros and a cover image**, with no one running Claude locally.

### Flow
1. Member pastes a **recipe blurb** on a `/submit` page (gated by Convex Auth).
2. A **server action / route handler** (keys server-side only) calls the **Claude API** with:
   - **Structured outputs** (JSON Schema = the Sanity recipe shape: ingredient lines mapped to catalog refs, optional flags, steps, `macros.base`/`macros.full`).
   - **Prompt caching** — the normalization rules + per-100g macro table (from `memory/recipe-import-process.md`) as a cached system block.
   - Default model **Claude Haiku 4.5**, with **Sonnet 4.6** as a quality fallback.
3. The pipeline **maps each ingredient to the catalog** (reuse existing; create-if-missing) and, for **new** ingredients, assigns the **stock metadata** Spec 2 needs (category, canonicalUnit, density, restockQuantity).
4. The member **reviews/edits the draft** (ingredient table, optional flags, macro range, steps).
5. Generate the **cover image** via `generateCover()` (Sanity `generate_image` for v1; swappable to fal.ai FLUX later).
6. **Publish** to the global Sanity cookbook (write via `@sanity/client`, the proven path).

### Editing existing recipes
Light edits to text fields are free; **changing ingredients re-runs normalization** so macros + stock metadata stay correct. The old manual recipe-create form is retired.

### Guards / cost
Submission gated to authed members + a light **per-user/day rate limit**. Cost ≈ **$0.01–0.03/recipe** (cached Haiku text ≪$0.01 + image). Keys (`ANTHROPIC_API_KEY`, Sanity write token, future fal key) are **server-side only**.

### Testing
Structured-output schema conformance, catalog mapping (reuse vs create), stock-metadata assignment for new ingredients, macro computation reuse, draft edit → publish, re-normalize-on-ingredient-change, rate-limit, auth gating.

---

## 8. Build order & dependencies

1. **Spec 1 — Foundation.** Gates everything (auth + households + the Convex/Sanity split + migration).
2. **Ingredient stock-metadata backfill** (prerequisite for Spec 2 depletion). A **one-time enrichment pass** populates `canonicalUnit`/`density`/`restockQuantity`/`category` for all existing catalog ingredients. This is the legitimate home for the "Claude with an API key, bulk admin" idea — run once by the owner; not in the user flow.
3. **Spec 2 — Data model + depletion.** Needs Spec 1 + the backfill.
4. **Spec 3 — UX.** Consumes Spec 2 data.
5. **Spec 4 — Import pipeline.** Independent of 2/3 except that it also produces stock metadata for new ingredients; can be built in parallel with 3 after 1.

**Stopgap:** the optional-"missing" bug fix (count required only) is trivial and can ship immediately on the current Sanity code if you want relief before the migration lands — otherwise it's absorbed by Spec 2/3.

## 9. Cost summary (all free or pennies)

- **Convex** free tier (1M function calls/mo, 0.5GB DB, 1GB files) — fine for a household or two; offload large images to Sanity (already the plan).
- **Sanity** free tier unchanged for content + images; `generate_image` credits (100/mo free) for covers in v1.
- **Claude API** ≈ pennies/recipe (no free tier, but tiny volume).
- Net: effectively free at this scale.

## 10. Risks & deferred

- **Depletion accuracy** — gram conversions are approximate (free-text quantities, "to taste", counts). Mitigated by manual pantry adjust + the optional-used prompt. Accept approximate.
- **Two systems** (Sanity + Convex) — accepted trade-off; revisit a full Convex migration only if running both becomes painful.
- **Deferred:** multi-household + switcher, email invites, fal.ai image swap, URL/photo recipe input, cross-household aggregate rating social proof, cross-unit grocery summation.
