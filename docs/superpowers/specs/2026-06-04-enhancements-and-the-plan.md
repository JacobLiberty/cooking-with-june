# Enhancements & "The Plan" — Design Spec

**Date:** 2026-06-04
**Status:** Approved (design)
**Builds on:** the shipped app (Next.js 16 App Router, Sanity, Auth.js v5, olive/Caslon design, June art). See `docs/superpowers/specs/2026-05-29-cooking-with-june-design.md` and `design.md`.

## Overview

Five additions, in two build chunks:

- **Chunk 1 — quick wins + PWA:** June-approved seal, share link, recipe notes, installable PWA.
- **Chunk 2 — The Plan:** a shared household meal-planner + grocery list at `/plan`.

All writes stay editor-gated via the existing `requireEditor()`; reads stay public except the editor-gated `/plan` page.

---

## A. June-approved seal

A small badge — a pawprint + "June approved" — marking recipes the household genuinely loves.

- **Rule:** approved when there are **≥ 2 editor ratings** AND **every** rating is **≥ 4.5** (i.e., you *both* rated it 4.5★+). Pure helper `isJuneApproved(ratings)` — TDD.
- **Where:** on the `RecipeCard` (small) and the recipe detail header (next to the title/meta).
- **Style:** olive + clay, uses the existing `PawMark`. Quiet, editorial — not a loud sticker.

## B. Share link

- A **"Copy link"** button on the recipe detail page. Copies the canonical recipe URL via `navigator.clipboard`, shows transient "Copied!" feedback. Client component, available to everyone (sharing is public).
- Rich link previews already work via the recipe page's `generateMetadata` (title + description). A custom OG image is **future**, not in scope.

## C. Recipe notes

- **Display** the `notes[]` we already store (`{ author?, text }`) in a "From our kitchen" section on the recipe detail page — editorial styling (Newsreader italic, olive), author as a small kicker.
- **Add** (editor-only): an inline form → server action `addNote(recipeId, text)` — `requireEditor()`, `assertRecipe()`, append `{ _key, author: <signed-in editor name>, text }` to `notes[]`. Validate non-empty + length cap (≤ 500). Revalidate the recipe path.

## D. PWA (installable, online — no offline)

- `src/app/manifest.ts` (Next metadata route) → `name` "Cooking with June", `short_name` "June", `start_url` "/", `display` "standalone", `background_color`/`theme_color` from the palette (paper `#faf4ea` / olive `#55622f`), icons from the June icon (192 + 512, incl. a maskable).
- Add `themeColor` + apple-touch-icon via metadata in the root layout.
- Generate 192/512 PNG icons from the existing June loaf icon.
- **No service worker / offline caching in v1** — the app is online (content from Sanity). This is purely "Add to Home Screen" → full-screen, June icon. (Offline is a future option.)

---

## E. The Plan (Model A — one shared household plan)

A planning tool for the household: add recipes to the plan, get a combined grocery list, check things off as you shop.

### Access
- Route **`/plan`**, **editor-gated** (non-editors `redirect("/")`). A **"Plan"** nav link shown only to editors (client `AuthControls`-adjacent or a viewer-aware nav item). Non-logged-in friends never see it; they browse public recipes only.
- **Model A:** ONE shared plan for all editors (the household). Documented upgrade path to **Model B** (per-household plans) later: add a `household` grouping and scope the plan doc by it — not built now (YAGNI; user may revisit).

### Data — `mealPlan` singleton (Sanity)
A single document (fixed id, e.g. `mealPlan`):
- `recipes[]` — references to planned `recipe` docs.
- `manualItems[]` — `{ _key, name, gotIt }` free-text grocery items (e.g., "milk for coffee").
- `checkedIngredients[]` — array of ingredient `_id`s that are checked off (the "got it" state for auto-generated items).

### Behavior
- **Add / remove recipe:** "Add to plan" / "Remove" button on recipe cards + detail → `addToPlan(recipeId)` / `removeFromPlan(recipeId)` (editor-gated, assertRecipe).
- **Grocery list (auto):** aggregate ingredient lines across the planned recipes, **deduped by ingredient** (group by ingredient `_id`). Each ingredient listed **once** with its amounts in brackets:
  - two recipes needing onion → **"Onion"** once.
  - cream at "1 cup" and "0.5 L" → **"Cream (1 cup · 0.5 L)"** (no math; list the amounts).
  - Pure helper `buildGroceryList(recipes)` → `[{ ingredientId, name, amounts: string[] }]` — TDD.
- **Per item:** **check off** (✓ got it → strike/move to a "Got it" section) or **delete** (remove from view). Auto items keyed by ingredient id (checked state in `checkedIngredients`); deleting an auto item = treat as checked/hidden (or a separate `removedIngredients` — keep simple: delete = mark checked/hidden).
- **Manual items:** an "add item" input → `addManualItem(name)`; each manual item is checkable (`toggleManualItem`) and deletable (`deleteManualItem`).
- **Master checkbox** at the top of the list: **mark all "got"** in one tap, and tap again to **clear all**.
- **Planned recipes view:** the recipes you've added, shown as cards, each with "remove from plan" → so you can pick what to cook.

### Server actions (all `requireEditor()`, operate on the `mealPlan` singleton)
`addToPlan`, `removeFromPlan`, `toggleGroceryItem(ingredientId)`, `deleteGroceryItem(ingredientId)`, `addManualItem(name)`, `toggleManualItem(key)`, `deleteManualItem(key)`, `setAllGot(boolean)`. Each revalidates `/plan` (+ `/` for the add-to-plan button state). Manual item names validated (non-empty, ≤ 120 chars). Uses the lazy write client + a deterministic singleton id (`setIfMissing` to create on first write).

### Pure logic (TDD)
- `isJuneApproved(ratings)` (chunk 1).
- `buildGroceryList(plannedRecipes)` — dedupe + amount-collect.
- Grocery view-model helper if needed (split auto items into "to get" vs "got" using `checkedIngredients`).

---

## Out of scope (now)
- **Model B** per-household plans (future).
- **Pantry inventory** / "filter the main page by what's in the fridge" (future/maybe).
- Made-it history surfacing, printable recipe, photo gallery, ingredient-name search, OG images, offline PWA caching.

## Security & testing
- All Plan + note writes gated by `requireEditor()`; recipe-targeting actions use `assertRecipe()`; manual item + note text validated/capped.
- The `mealPlan` doc lives in the public dataset, so the plan/grocery list is technically queryable via the public API (recipe refs + grocery names — low sensitivity). Acceptable for a personal app; flagged like the editor-email tradeoff, hardened (private dataset) only if desired.
- Write token stays server-only (lazy write client). Revalidation after writes.
- Pure logic TDD (`isJuneApproved`, `buildGroceryList`); component tests for the seal and the grocery list interactions.
- Final code review + security review over the whole batch.

## Build order
1. **Chunk 1** (independent, low-risk): seal → share → notes → PWA.
2. **Chunk 2:** The Plan (new schema + page + actions).
Each chunk: branch off `main` → plan → subagent-driven build with per-task spec + quality review → fix → merge. Final security review at the end.
