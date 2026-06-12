# Spec 3 — Agent Handoff (Plan / Shop / Pantry UX)

> Transfer doc for the next agent. Specs 1 and 2 are **done**. This is everything you need to pick up **Spec 3** (the UX redesign) without prior context. Read this top-to-bottom, then the two memory files and the master spec before doing anything.

## 0. First actions (in order)

1. Read your memory: `MEMORY.md` → **`app-overhaul-status.md`** (full progress + gotchas) and **`app-overhaul-decisions.md`** (locked decisions). Also `ux-overhaul-and-motion.md` (the existing motion/visual stack) and `recipe-import-process.md`.
2. Read the master spec: `docs/superpowers/specs/2026-06-11-cooking-with-june-overhaul-design.md` → the **"Spec 3"** section (§6). The detailed Spec 2 design (which you build on) is `docs/superpowers/specs/2026-06-11-cooking-with-june-spec-2-pantry-design.md` (§6/§7 describe the lib + API you consume).
3. **Spec 3 is UX work → you MUST brainstorm with the user first.** Invoke the `superpowers:brainstorming` skill, confirm the design (offer the visual companion — this is heavily visual), get approval, write the spec, then `superpowers:writing-plans`, then execute via `superpowers:subagent-driven-development`. Do NOT start building UI before the user approves a design.

## 1. Project state

- **App:** "Cooking with June" — Next.js 16 (App Router) + Sanity (immutable content: recipes, ingredient catalog) + Convex (`perfect-fennec-845`, all mutable per-household state) + Convex Auth (Google).
- **Branch:** `design/app-overhaul-spec` — keep working here. **Do NOT push or open PRs** (the user does that). Commit on the feature branch freely.
- **Sanity:** project `zwjctldy`, dataset `production`.
- **Validation loop:** `npx convex dev --once` (deploys/validates Convex). Tests: `npm test`. Lint: `npm run lint`. Types: `npx tsc --noEmit`. Full gate must be green before "done".
- **Tests today:** ~290 passing across ~53 files.
- **Security review:** deferred to the **very last phase of the whole overhaul** (user's call). Don't run it per-phase.

## 2. What Spec 2 built that Spec 3 consumes

The entire pantry/grocery/plan backend + the buy→cook→deplete→re-need→skip loop is done and tested. **Spec 3 is the UI on top of it — no new backend logic should be needed** (except the one gap in §4).

### Read API — `src/app/actions/kitchen-data.ts` (server actions, owner/member-gated)
- `getPlanData()` → `{ recipeId: string; scale: number; coverage: { cookable: boolean; missingRequired: number } }[]` — the "cooking soon" set, coverage is **plan-scaled**.
- `getPantryData()` → `{ ingredientId: string; quantityG: number; restockOverride: {quantity,unit}|null; updatedAt: number }[]` — **NB: no ingredient name or unit-kind** (see §4 gap).
- `getShopData()` → `{ needs: GroceryNeed[]; manual: {ingredientId, source:"manual", manualQuantity:{quantity,unit}|null}[]; skipped: string[] }`.
  - `GroceryNeed = { ingredientId: string; name: string; amount: number; optional: boolean }` (name IS present here, from the recipe line). Needs are **computed** (plan×scale − pantry), skipped ones already excluded.
- `getCookableCoverage(recipeIds: string[])` → `Record<recipeId, { cookable, missingRequired }>` — **base scale 1** ("can I make this recipe as written?"), for the browse/home filter. (getPlanData coverage is plan-scaled; don't conflate them.)

### Loop actions — `src/app/actions/kitchen-actions.ts` (server actions)
`addToPlan(recipeId, scale=1)`, `removeFromPlan(recipeId)`, `setScale(recipeId, scale)`, `markBought(ingredientId)` (adds restock to pantry, removes the manual row, reconciles skips), `cook(recipeId, usedOptionalIds: string[])` (deplete required + the optionals passed, increments madeCount, **removes recipe from plan**, reconciles skips), `addManualItem(ingredientId, manualQuantity?)`, `removeManualItem(ingredientId)`, `skipItem(ingredientId)`, `unskipItem(ingredientId)`, `setPantryQuantity(ingredientId, quantityG)`, `setRestockOverride(ingredientId, restock?)`.

### Canonical-unit invariant (load-bearing — respect it in the UI)
`pantryItems.quantityG` and every "amount" is in the ingredient's **canonical unit**: **grams** for mass/volume-kind, an **item count** for count-kind. The UI must show the right unit label (`g` vs a count) — driven by the ingredient's `canonicalUnitKind`. `setPantryQuantity` takes a bare canonical number, so the input must tell the user which unit to type. Count-kind amounts can be **fractional** (e.g. 4.8 eggs) — decide display rounding.

### Pure lib (already tested, reuse — don't reimplement)
`src/lib/kitchen/`: `convert` (lineToGrams/lineToCanonical), `requirements` (recipeRequirements), `need` (computeNeeds), `cookable` (recipeCoverage), `deplete` (depletionDeltas), `assemble` (raw-Sanity↔shape helpers). `src/lib/enrichment/types.ts` exports `CANONICAL_UNIT_KINDS`/`INGREDIENT_CATEGORIES` enums.

### Server→Convex pattern (copy this for any new server action)
```ts
import { fetchQuery, fetchMutation } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@cvx/_generated/api";        // @cvx → convex/
const token = await convexAuthNextjsToken();
await fetchQuery(api.pantry.pantry, {}, token ? { token } : {});
```
Auth gate: `requireMember()` / `getViewer()` from `@/lib/viewer` (viewer has `role: "owner"|"member"|null`). Server-action tests mock `@/lib/viewer`, `convex/nextjs`, `@convex-dev/auth/nextjs/server`, `@/sanity/lib/client` — see `src/app/actions/kitchen-data.test.ts` + `plan-actions.test.ts`.

## 3. The Spec 3 scope (from master spec §6 — brainstorm/refine with user)

Three focused views replacing the 451-line god-component `src/components/plan-view.tsx`:
- **Plan** — the "cooking soon" set: recipe rows + serving scale + a **required-only** missing badge + a **Cook / Made-it** action. Cook must prompt **"which optional ingredients did you use?"** (multi-select) → passes the chosen ids to `cook(recipeId, usedOptionalIds)`.
- **Shop** — grocery list **grouped by store-category** (Produce → Dairy → Protein → Pantry → Spice → Non-food) with an **optional / "nice-to-have" group** at the bottom. Add-item uses **catalog autocomplete + create-if-missing** (no free-text). Check-off = `markBought`.
- **Pantry** — stock with quantities, manual adjust (`setPantryQuantity`), restock defaults visible/overridable (`setRestockOverride`). Unit-aware (g vs count).
- **Shopping mode** — focused, large-touch-target, mobile-first: category-grouped, big check-off, progress, optional group separated. Honor `prefers-reduced-motion` (see `PRODUCT.md`).
- **Filter rework** — typeahead ingredient search + collapsible category facets + a pantry-aware **"cookable now / missing ≤N" toggle** wired to `getCookableCoverage`. (Replaces the current button-per-ingredient + id-set approach.)

Visual treatment (terracotta editorial, type hierarchy, motion) is done at build time with the `frontend-design` / `i-impeccable` skills + a visual mockup pass. This spec fixes IA + behavior; lean on the existing motion/visual stack (`ux-overhaul-and-motion` memory).

## 4. Required new backend work for Spec 3 (the one gap)

**Batch ingredient-catalog query.** `getPantryData` and the `manual` grocery rows return only `ingredientId` — no display name or `canonicalUnitKind`. Spec 3 needs a batch GROQ `id → { name, canonicalUnitKind, category, restockQuantity }` to render pantry/manual rows and the correct unit label + add-item autocomplete. Add it (e.g. extend `src/sanity/lib/kitchen-queries.ts`), and likely fold the name/kind into `getPantryData`/`getShopData` so the UI gets display-ready data. `INGREDIENT_NAMES_QUERY` (id+name only) already exists for autocomplete seed; the full catalog query for the add-item picker can reuse `INGREDIENTS_QUERY` shape.

## 5. What to retire/replace (old → new)

These are the **transitional** pieces Spec 2 deliberately left in place (the app was backend-only; Spec 3 owns the UI cutover):
- **Retire** `src/components/plan-view.tsx` (451-line god-component), `src/app/actions/plan-actions.ts` (old Sanity-`mealPlan` server actions), and the Sanity `mealPlan` doc reads. Replace with the three new views on the Convex API above.
- **Retire** `src/lib/pantry.ts` `filterCookable`/`missingFromPantry` (id-set, set-membership) — replace the home/collection "cookable now" filter with the quantity-aware `getCookableCoverage`. This touches `src/app/(site)/page.tsx` + `src/components/collection-view.tsx` (currently passes `pantryIds` set + uses `filterCookable` with modes any/most/all). **This is the interactive cookable rewire deferred from Spec 2c.**
- **Fix** `revalidatePath` targets in `kitchen-actions.ts` (currently placeholder `/plan` and `/`) to the real Spec 3 routes.
- **Remove** the one-time migration tool once you've confirmed with the user it's no longer needed: `src/app/(site)/admin/migrate/page.tsx` + `src/components/migrate-runner.tsx`. (The migration was already RUN successfully. The pure logic `src/lib/kitchen/migrate.ts` + `migrate-actions.ts` can stay or go — ask.) **The user already ran the migration; do NOT re-run it.**
- The old Sanity `mealPlan` doc + its schema (`src/sanity/schemaTypes/documents/meal-plan.ts`) + `manual-item.ts` object become dead once the UI is cut over — coordinate removal with the user (and there's orphaned data in it; harmless).

## 6. Working agreement (the user's, follow exactly)

- **Brainstorm → confirm design → task plan → explicit approval → implement.** UX/visual work: implement first then add behavior tests; backend logic (the §4 query): TDD red-green.
- **Branch only** (`design/app-overhaul-spec`); never main. Per-phase commits.
- **After each phase:** full gate (test + lint + tsc + `npx convex dev --once`), then `/code-review`, address findings. Security review deferred to the final overhaul phase.
- Surface decisions that change flow/architecture/scope; just-apply small fixes (bugs, naming, validation, local refactors, dead-code removal).
- **Do NOT push or open PRs.** Use context7 to confirm library APIs rather than memory. Prefer existing deps.
- The user wanted autonomous execution through Spec 2; reconfirm cadence for Spec 3 (it's UX, so more brainstorming/visual checkpoints are expected up front).

## 7. Subagent-driven execution notes (what worked in Spec 2)

- Decompose into sub-plans (Spec 2 was 2a/2b/2c-1/2c-2/2d); Spec 3 likely splits by view (catalog query + Pantry, Shop + shopping mode, Plan + cook flow, filter rework + home cutover).
- Per task: dispatch a fresh implementer (sonnet for mechanical, opus for design/holistic review) → independent **spec-compliance + quality review** → fix → next. A final **opus holistic review** per sub-plan caught real cross-file bugs. Give implementers full code/specs; they follow verbatim well. Some implementer agents return a findings-audit instead of a status — verify git state + tests directly when that happens.
- Convex `api.*` proxy refs are **not stable** in test mocks — match on content/args, not `fn === api.x.y`. `Date.now()` is allowed in Convex mutations/server actions but **banned in workflow scripts**.
- Commit generated `convex/_generated/*` alongside Convex function changes.

## 8. Key files map

- **Consume:** `src/app/actions/kitchen-data.ts`, `src/app/actions/kitchen-actions.ts`, `src/lib/kitchen/*`, `convex/{plan,pantry,grocery,cook}.ts`.
- **Replace:** `src/components/plan-view.tsx`, `src/app/actions/plan-actions.ts`, `src/lib/pantry.ts` (filterCookable), `src/app/(site)/page.tsx` + `src/components/collection-view.tsx` (cookable filter), `src/lib/recipe-filter.ts` (filter modes).
- **Patterns to copy:** `src/app/(site)/page.tsx` (server-merge Sanity+Convex), `src/sanity/lib/queries.ts` (GROQ), `src/components/*` (terracotta UI + motion), `PRODUCT.md` (motion/reduced-motion rules).
- **Plans/specs:** `docs/superpowers/plans/` (2a–2d plans show the format), `docs/superpowers/specs/` (master + Spec 2 design).

## 9. Gotchas / truths to carry forward

- Pantry/grocery are now **per-household Convex** (Spec 2). The old global Sanity `mealPlan` doc is abandoned (migration already pulled the founder's data over).
- Grocery **plan-needs are computed, never stored**; only `manual` + `skip` rows are stored. Re-need is automatic. Skip auto-clears when need→0 (handled in `reconcileSkips`).
- Cook **removes the recipe from the plan**. The "did you use the optionals?" prompt is **Spec 3 UI** — pass the selected ids to `cook`.
- Restock units are a deliberate metric/imperial mix (Canadian shopping) — do not "fix" to all-metric.
- 17 catalog ingredients were created for the founder's non-recipe staples (havarti, bagels, etc.) and enriched; they're real catalog ingredients now.
