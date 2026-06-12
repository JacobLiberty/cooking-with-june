# Spec 3 — Plan / Shop / Pantry UX Redesign (design)

> Brainstormed 2026-06-11 on branch `design/app-overhaul-spec`. This is the third
> sub-project of the four-spec overhaul. It builds the **UI** on top of the
> finished Spec 2 backend (the per-household pantry / grocery / plan model + the
> buy→cook→deplete→re-need→skip loop). No new backend logic except one batch
> catalog query and one shared enriched-ingredient create helper.
>
> Reference: master spec `2026-06-11-cooking-with-june-overhaul-design.md` §6;
> handoff `docs/superpowers/SPEC-3-HANDOFF.md`; Spec 2 design
> `2026-06-11-cooking-with-june-spec-2-pantry-design.md`.

## 1. Goal

Replace the 451-line tabbed god-component `src/components/plan-view.tsx` (and its
old Sanity-`mealPlan` server actions) with **three focused, well-bounded views**
— Menu / Shop / Pantry — plus a mobile-first **shopping mode**, plus a rework of
the home "cookable now" filter to be **quantity-aware** (wired to Spec 2's
`getCookableCoverage` instead of the old pantry id-set).

This spec fixes **information architecture and behavior**. The terracotta
editorial visual treatment + motion are applied at build time using the existing
stack (`MotionProvider`, View Transitions, the `frontend-design` / `i-impeccable`
skills) and the `ux-overhaul-and-motion` conventions.

## 2. What Spec 2 already provides (consumed, not rebuilt)

Read API — `src/app/actions/kitchen-data.ts` (member-gated server actions):
- `getPlanData()` → `{ recipeId, scale, coverage: { cookable, missingRequired } }[]` — coverage is **plan-scaled**.
- `getPantryData()` → `{ ingredientId, quantityG, restockOverride, updatedAt }[]` — **no name/unit-kind** (see §6, the gap).
- `getShopData()` → `{ needs: GroceryNeed[], manual: {ingredientId, source, manualQuantity}[], skipped: string[] }`; `GroceryNeed = { ingredientId, name, amount, optional }`. Needs are **computed** (plan×scale − pantry); skips already excluded.
- `getCookableCoverage(recipeIds)` → `Record<recipeId, { cookable, missingRequired }>` at **base scale 1** ("can I make this as written?").

Loop actions — `src/app/actions/kitchen-actions.ts`:
`addToPlan`, `removeFromPlan`, `setScale`, `markBought`, `cook(recipeId, usedOptionalIds)`,
`addManualItem`, `removeManualItem`, `skipItem`, `unskipItem`, `setPantryQuantity`, `setRestockOverride`.

Canonical-unit invariant (load-bearing): `quantityG` and every "amount" is in the
ingredient's **canonical unit** — **grams** for mass/volume-kind, an **item count**
for count-kind. The UI must render the right unit label from the ingredient's
`canonicalUnitKind`. Count amounts can be fractional (e.g. 4.8 eggs).
`cook(...)` depletes required + the passed optional ids, **clamped at 0** (never
negative), bumps made count, and **removes the recipe from the plan**.

## 3. Navigation & routing

- Global header gains one umbrella entry, **Kitchen** (members only; signed-out
  users see only Home + Sign in). The current "Plan" link in the auth controls is
  removed.
- Three sibling routes — `/menu`, `/shop`, `/pantry` — share a **segmented
  sub-nav** (`Menu | Shop | Pantry`) rendered at the top of each page, so the
  three read as one loop. Active state derives from `usePathname`.
- The view formerly called "Plan" is renamed **Menu** (`/menu`). The old `/plan`
  route is removed (internal, no redirect needed).

## 4. The three views + the home filter

### 4.1 Menu (`/menu`)

The "cooking soon" set. Data: `getPlanData()` + a light GROQ query giving each
planned recipe its `title` and its **optional** ingredient lines (`{ id, name }`)
for the cook prompt.

Each recipe row:
- **Serving-scale stepper** → `setScale(recipeId, scale)`. Changing it re-derives
  the **required-only missing badge** (from plan-scaled `coverage.missingRequired`)
  and the Shop needs. The Menu does not list every ingredient quantity (that is
  the recipe page's job); it shows recipe + scale + "missing N" badge — that badge
  is what updates as the scale changes.
- **View / cook** — a plain link to the recipe page and its separate step-by-step
  cook mode. This path **never depletes**.
- **"Made it"** — the deliberate depleting action. Tapping it **expands the row
  inline** into a checklist of that recipe's *optional* ingredients ("which did
  you use?") + a prominent **"Confirm — made it"** button in the thumb zone.
  Confirm → `cook(recipeId, usedOptionalIds)`. If the recipe has **no** optionals,
  the expanded panel is just the confirm line (still two-tap, so depletion can't
  happen by accident). Honors `prefers-reduced-motion` on the expand.
- **Remove** — takes the recipe off the menu without depleting (`removeFromPlan`).

Empty state: cozy "nothing planned — add recipes from their pages" (June art,
matching existing tone).

### 4.2 Shop (`/shop`)

Data: `getShopData()`. Manual rows are joined with the batch catalog query (§6)
for name + unit-kind + category.

- **Grouped by store-category**: Produce → Dairy → Protein → Pantry → Spice →
  Non-food, with an **optional / "nice-to-have"** group pinned at the bottom.
  `category` comes from the catalog; "optional" from `GroceryNeed.optional`.
- **Check off** = `markBought(ingredientId)` (adds restock qty to pantry, clears
  the manual row, reconciles skips). **Skip** = `skipItem(ingredientId)`. Both
  animate out via the existing `AnimatePresence` pattern.
- **Add an item**: catalog **typeahead**. Match → `addManualItem(ingredientId)`.
  No match → **"Create '<name>'"** → `getOrCreateEnrichedIngredient` (§6) then
  add. No free-text path. Amounts are unit-aware (g vs count).
- **Start shopping** toggle → flips the *same* page into **shopping mode**:
  large tap targets, department-sorted, big check-off, a progress indicator
  ("7 of 12"), the optional group separated, minimal chrome. Mobile-first; same
  data, mode held in component state. Honors `prefers-reduced-motion`.

### 4.3 Pantry (`/pantry`)

Data: `getPantryData()` joined with the batch catalog query (§6) for name +
`canonicalUnitKind` + restock default.

- Each row shows the name and current quantity with the **correct unit label** —
  `g` for mass/volume-kind, a bare count (e.g. "×4") for count-kind. Count amounts
  may be fractional; **display rounds to a sensible precision** (whole number, or
  one decimal when fractional) while the exact stored value is preserved.
- **Adjust quantity**: a direct numeric input labeled with the canonical unit,
  plus quick **− / +** nudge buttons. Commits via `setPantryQuantity(ingredientId,
  canonicalNumber)`. The input communicates which unit to type (g vs count).
- **Restock default** shown with an inline editable override → `setRestockOverride`.
  Clearing the override falls back to the catalog default.
- Empty state: "Your pantry is empty — check things off your shopping list and
  they'll land here."

### 4.4 Home filter rework (`/`)

- The home server component (already fetching all recipes) additionally calls
  **`getCookableCoverage(allRecipeIds)`** once (members only) and passes the
  `{ cookable, missingRequired }` map into `CollectionView`.
- Filter controls become: **typeahead ingredient search** (add a few ingredients
  to filter by) + **collapsible category facets** (tags) + a pantry-aware
  **stepper**: *Cookable now · missing ≤1 · ≤2 · ≤3* — filtering instantly
  client-side against the coverage map. Replaces the button-per-ingredient grid,
  the any/most/all modes, and the old `filterCookable` id-set.
- Coverage is as-of page load (the pantry rarely changes mid-browse) and is
  base-scale-1 ("can I make this as written?"). Do not conflate with the
  plan-scaled coverage on `/menu`.

## 5. Component boundaries

Each view is its own small, independently testable client component fed by a thin
server page (the server-merge pattern from the current `page.tsx`):

- `src/app/(site)/menu/page.tsx` → `MenuView` (+ `MenuRecipeRow`, the inline cook
  prompt). Replaces `plan/page.tsx` + `plan-view.tsx`.
- `src/app/(site)/shop/page.tsx` → `ShopView` (+ category grouping, `AddItem`
  typeahead, shopping-mode presentation).
- `src/app/(site)/pantry/page.tsx` → `PantryView` (+ `PantryRow` with unit-aware
  adjust + restock override).
- A shared `KitchenSubnav` component for the `Menu | Shop | Pantry` segmented nav.
- `CollectionView` / `FilterControls` reworked for typeahead + facets + the
  cookable stepper.

## 6. New backend work

**6.1 Batch ingredient-catalog query** (TDD). Extend
`src/sanity/lib/kitchen-queries.ts` with `INGREDIENTS_BY_IDS` →
`{ id → { name, canonicalUnitKind, category, restockQuantity, nonfood } }`. Fold
it into the read API so the UI receives display-ready data:
- `getPantryData()` rows gain `name`, `canonicalUnitKind`, `restockDefault`.
- `getShopData()` `manual` rows gain `name`, `canonicalUnitKind`, `category`.
- The add-item typeahead's catalog source reuses the existing
  `INGREDIENTS_QUERY` / `INGREDIENT_NAMES_QUERY` shape.

**6.2 `getOrCreateEnrichedIngredient(name)`** (TDD) — a shared server-side helper.
Look up by `lower(name)`; if missing, call `enrichBatch([name])`
(`src/lib/enrichment/client.ts`, Haiku default / Sonnet fallback), run the result
through the existing `src/lib/enrichment/` select + validate, and create + publish
the `ingredient` with full stock metadata. Used by **both** the Shop add-item flow
*and* the recipe form's existing `getOrCreateIngredient` (which currently creates a
**bare, un-enriched** ingredient) — one create path, closing the unenriched-entry
gap. **Fallback:** if enrichment is unreachable/unusable, create with safe defaults
and flag rather than throwing, so adding an item never hard-fails.

## 7. What gets retired / replaced

- **Delete** `src/components/plan-view.tsx`, `src/app/actions/plan-actions.ts`,
  `src/app/(site)/plan/page.tsx`, and the Sanity `mealPlan` reads
  (`plan-queries.ts`, `plan-types.ts`).
- **Delete** `src/lib/pantry.ts` `filterCookable` / `missingFromPantry` and the
  old `recipe-filter` any/most/all modes — replaced by `getCookableCoverage` + the
  stepper.
- **Fix** the placeholder `revalidatePath` targets in `kitchen-actions.ts`
  (`/plan`, `/`) to the real routes (`/menu`, `/shop`, `/pantry`, `/`).
- **Remove** the one-time migration tool (`src/app/(site)/admin/migrate/page.tsx`
  + `src/components/migrate-runner.tsx`); migration already run. The pure
  `migrate.ts` / `migrate-actions.ts` can stay or go (decide at that step).
- The old Sanity `mealPlan` doc + schema (`meal-plan.ts`, `manual-item.ts`) become
  dead once the UI is cut over — flag removal for the owner to do in Studio
  (orphaned data, harmless).

## 8. Sub-plan decomposition (foundation-first, then by view)

Each sub-plan is independently testable, committed on `design/app-overhaul-spec`,
and gets a `/code-review` pass with findings addressed. Security review is
deferred to the very last phase of the whole overhaul.

- **3a — Foundation.** Batch catalog query (6.1) + read-API shaping;
  `getOrCreateEnrichedIngredient` (6.2) + recipe-form unify; the **Kitchen** header
  entry + `Menu | Shop | Pantry` sub-nav shell + route scaffolding + the
  Plan→Menu rename. Backend = TDD; nav = behavior tests.
- **3b — Pantry** (`/pantry`). Simplest view; exercises the batch query +
  unit-aware display + `setPantryQuantity` / `setRestockOverride`. Built before
  Shop/Menu to prove the catalog/unit plumbing on the smallest surface.
- **3c — Shop** (`/shop`). Category grouping, check-off / skip, enriched add-item,
  shopping-mode toggle.
- **3d — Menu** (`/menu`). Scale stepper, the inline "Made it" cook flow +
  optionals prompt; retires `plan-view.tsx` + `plan-actions.ts` + `/plan`.
- **3e — Home filter rework.** Wire `getCookableCoverage`, typeahead + facets +
  stepper; retire `filterCookable` / old modes; fix `revalidatePath`; remove the
  migrate tool.

## 9. Testing

Per the working agreement: **TDD (red-green)** for backend bits — batch-query
shaping, `getOrCreateEnrichedIngredient` (reuse vs create vs enrichment-fallback),
coverage wiring. **Behavior tests after** for UI — required-only missing badge,
category grouping + optional-group placement, shopping-mode check-off →
`markBought`, the cook optionals prompt → `cook(recipeId, ids)`, autocomplete
reuse vs create (no dup), unit-label correctness (g vs count), filter facet +
cookable-stepper behavior. Full gate after each sub-plan: `npm test` +
`npm run lint` + `npx tsc --noEmit` + `npx convex dev --once`.

## 10. Non-goals / deferred

- True self-serve recipe import (Spec 4) — independent; the enriched-create helper
  here is a small reusable slice the pipeline can later build on.
- Removing the dead Sanity `mealPlan` doc/schema in Studio (owner action, flagged).
- Multi-week menus / scheduling, store-route ordering, barcode scan — out of scope.
