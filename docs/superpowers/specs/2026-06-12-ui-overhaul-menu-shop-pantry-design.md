# UI Overhaul: Menu, Shop, Pantry (+ Home/Recipe tweaks)

**Date:** 2026-06-12
**Status:** Approved
**Scope:** Visual and interaction overhaul of the Menu, Shop, and Pantry pages; small
hierarchy tweaks on Home and Recipe detail; supporting backend changes (whole-number
quantities, buy-quantity model, deplete mutation).

Decisions were made interactively with mockups (archived under
`.superpowers/brainstorm/95774-1781311279/content/`, gitignored). Chosen directions:
Menu = editorial spread (A), Shop = quiet rows with tap-to-edit quantity (B),
Pantry = dense ledger with always-visible actions (A) using cart + X icons (B).

---

## 1. Menu page — editorial spread

Each planned recipe renders as a full-width editorial card, stacked vertically
(3–5 recipes expected):

- **Cover image** — wide banner (~3:1.4), thin ink keyline, reusing the existing
  view-transition morph (`coverTransitionName()`) so tapping through to the recipe
  feels continuous.
- **Title** below the image in display type, linking to the recipe.
- **Meta line** — `45 min · serves 4 · scale ×2`.
- **Coverage line** — `Ready to cook` (clay) or `Missing 2 — view` (terracotta).
  Tapping "view" expands an inline list of the missing ingredients, each with a
  one-tap **Add to list** action (adds as manual grocery item at default buy qty).
- **Actions row** — `Made it` solid pill (keeps the existing optional-ingredients
  confirmation flow before `cook()`), `− ×N +` scale stepper, quiet `Remove` link.
- **Header** — kicker becomes `Cooking soon · N recipes`.
- **Empty state** — short editorial line plus a link to the collection (home).

Data: extend the menu Sanity query (`MENU_RECIPES_QUERY`) to also return cover
image, total time, and servings — fields that already exist on recipes. No Convex
changes for this page beyond what Shop/Pantry introduce.

## 2. Shop page — one mode, quiet rows

**Delete shopping mode.** The `Start shopping` / `Done shopping` toggle and the
dual behavior go away. One behavior remains:

- **Check-off**: checking an item calls `markBought` with the row's buy quantity;
  the row stays in place, crossed out, with a confirmation meta line
  (`added 500 g to pantry`). Cross-out state is client-side only; the durable
  effect is the pantry write. A reload naturally clears crossed-out rows (they are
  no longer "needed"). A **Clear checked-off items** link at the bottom clears them
  on demand.
- **Progress**: a slim always-on progress bar under the title; kicker reads
  `This week · 2 of 5 in the basket` (aria-live, as today).
- **Add-item field moves to the top**, directly under the title rule, keeping the
  existing typeahead/create behavior.
- **Row anatomy**: checkbox · name · muted meta line `buying 473 g · needs 240 g`
  (manual items show just `buying X`; rows with no quantity data show nothing) ·
  `Won't buy` link. Tapping the meta line expands an inline stepper to adjust the
  buy quantity (canonical unit; whole numbers; nudge steps 10 g mass/volume, 1
  count).
- **"Won't buy" everywhere**: replaces both `Skip` (need items → still writes a
  `source: "skip"` row) and `Remove` (manual items → deletes the row). One label,
  same position, both kinds.
- **Grouping unchanged**: store-category sections with `Nice to have` (optional)
  last.

**Buy quantity semantics** (fixes shown-number ≠ added-number bug):

- Default = the ingredient's restock default (`restockQuantity` from Sanity),
  converted to canonical units via `restockToCanonical()`, rounded to a whole
  number.
- Fallback when no restock default: the needed amount rounded up to a whole number
  (manual items: their manual quantity, else 1 count / sensible canonical minimum).
- User edits are stored per-trip in Convex as a per-ingredient override and
  cleared when the item is bought or won't-buy'd. No "remember my usual size"
  persistence (YAGNI).
- `markBought` adds exactly the resolved buy quantity to the pantry.

## 3. Pantry page — dense ledger

Designed for 50–200 rows: compact, aligned, immediately actionable.

- **Grouped by store category**, same kicker headers and order as Shop
  (Produce → Dairy → Protein → Pantry → Spice & seasoning → Other); alphabetical
  within each group. (`nonfood` items, if any, fold into Other.)
- **Aligned columns** — each row is a strict grid: name (left, flexible, truncates)
  · `− qty +` with unit in a fixed-width right-aligned column so numbers align down
  the page · cart icon · X icon. Inline quantity editing and −/+ nudges stay
  (10 g mass/volume, 1 count).
- **Cart icon** (terracotta) — adds the ingredient to the grocery list as a manual
  item at its default buy quantity; quantity editable later on Shop. Tooltip +
  aria-label "Add to grocery list". If a manual grocery row already exists for
  the ingredient, the icon shows a subtle active/disabled state instead of
  duplicating.
- **X icon** (ink-soft) — "Out of it": deletes the pantry row and shows an undo
  toast: `Garlic removed — Undo · Add to list`. Tooltip + aria-label "Out of it —
  remove from pantry". Toast auto-dismisses (~6 s); Undo restores the row with its
  prior quantity; Add to list behaves like the cart icon.
- **Restock UI deleted** — the `Restock: X` display, Edit modal, and Reset button
  go away. Restock catalog data lives on only as the Shop buy-quantity default.
  `restockOverride` on `pantryItems` is retired (field deprecated; no longer
  written or read).
- Header kicker becomes `Your kitchen · N ingredients`.

## 4. Backend changes (Convex)

- **Whole-number quantities**: every pantry quantity write rounds to an integer
  (round half up): `adjustPantry`, `setPantryQuantity`, `cook` depletion deltas,
  buy additions. Display formatting drops decimals. A one-time migration
  mutation rounds existing `pantryItems.quantityG` values (approach per the
  convex-migration-helper skill at planning time).
- **Buy-quantity override**: stored on `groceryItems` — `source` union gains
  `"override"`, plus a new optional `buyQuantityG` field. Need-driven items with
  an edited buy quantity get a `source: "override"` row; manual items keep using
  `manualQuantity`. Overrides are cleared on bought / won't-buy /
  no-longer-needed reconciliation (extend `reconcileSkips`).
- **`markBought(ingredientId, buyQuantityG)`**: adds the resolved buy quantity
  (server re-validates: positive integer) instead of silently using the restock
  default.
- **`depletePantryItem(ingredientId)`**: removes the household's pantry row;
  idempotent. Undo is a client-side re-`setPantryQuantity` with the prior value.
- **Sanity**: no schema changes.

## 5. Home + Recipe detail tweaks

- **Home**: filter controls become one tidy row of kicker-style chips with active
  states and result counts; `What can I cook?` becomes a prominent toggle chip
  (members); to-try recipes get a small terracotta corner mark on their cards.
- **Recipe detail**: action hierarchy — `Cook mode` and `Add to menu` remain the
  two visible pills; `Edit` / `Share` / `Delete` collapse into a quiet `⋯`
  overflow row. Delete keeps its confirmation.
- Light consistency pass across all five pages (spacing rhythm, kicker usage,
  rule weights) — no other changes.

## 6. Cross-cutting

- **Visual identity preserved**: existing palette/typography tokens, `set-in`
  stagger motion, `rule-draw`, reduced-motion support, terracotta focus rings,
  `max-w-2xl` kitchen measure.
- **Optimistic UI**: all mutations keep optimistic state with revert-on-error and
  the existing quiet inline error line pattern.
- **Accessibility**: icons get aria-labels + tooltips; progress bar keeps
  aria-valuenow/aria-live; touch targets ≥ 28 px; checkbox semantics unchanged.

## 7. Error handling

- Mutation failure → revert optimistic state, show inline error line (existing
  pattern); no silent failures.
- `markBought` validates buy quantity server-side (positive integer, household
  membership) and fails fast with a clear message.
- Deplete/undo race (e.g. undo after a concurrent edit) resolves last-write-wins;
  undo restores the snapshot quantity.

## 8. Testing

Per repo conventions (unit tests for pure logic; UI implement-first then behavior
tests):

- **Pure logic (test-first)**: integer rounding at every write path; buy-quantity
  resolution (restock default → need fallback → manual fallback, conversion +
  rounding); pantry category grouping/sorting; depletion deltas with whole-number
  clamping; "Won't buy" routing (skip vs delete).
- **Behavior**: check-off adds the *edited* buy quantity to pantry; deplete →
  undo restores quantity; deplete → add-to-list creates manual grocery item; cart
  icon no-ops/disables when already listed; migration rounds existing decimals.
- Full suite + typecheck + lint before done; `/code-review` then
  `/security-review` per working agreement.

## Out of scope

- Dark mode, new dependencies, Sanity schema changes, "remember my usual buy
  size", persistent in-store basket state across reloads, drag-to-reorder menu.
