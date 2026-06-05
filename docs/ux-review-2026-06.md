# Cooking with June — UX Review & Improvement Plan

_June 2026. Method: Nielsen usability heuristics + current (2024–2025) UX research
(NN/g, Baymard, SideChef, Drizzlelemons, motion.dev, web.dev) cross-referenced
against a code audit of the live app._

## Overall score: **7.6 / 10 (B+)**

A genuinely polished, characterful app. The brand, the editorial voice, and the
newly-rebuilt Plan/pantry are real strengths. The biggest gains left are in the
**functional depth of the recipe detail page and cook mode** — the two screens a
cook actually stands in front of — plus a thin layer of tasteful motion.

### Scorecard

| Dimension | Score | Notes |
|---|---|---|
| Visual design & brand identity | 8.5 | Terracotta editorial system, June mascot, custom cards/placeholder — distinctive and consistent. |
| Information architecture & nav | 8.0 | Appropriately minimal for a small corpus; search + filters prominent. Nav is almost _too_ sparse. |
| Discovery & filtering | 8.0 | Collection segments, search, tags, pantry/ingredient filter (any/all), result count, "Surprise me," strong empty state. Missing facet counts. |
| Recipe detail page | 6.5 | Good structure, rating surfaced under title. **No interactive ingredient checkboxes, no serving scaler, no unit toggle.** |
| Cook mode | 6.5 | Wake-lock, big type, paw progress, ingredient peek — solid base. **No timers, no per-step ingredients, small nav targets, no step check-off.** |
| Meal plan & grocery/pantry | 8.0 | Tabs, alternating cards, optimistic, pantry persistence — differentiated and well-built. |
| Interaction feedback / micro-interactions | 7.0 | Optimistic UI, paw confetti, hover lift, paw loading. Room for exit animations + add-to-plan feedback. |
| Accessibility | 7.5 | Focus ring, ARIA roles, reduced-motion on CSS, semantic lists. Gaps: cook-mode tap targets, some `ink-soft` contrast. |
| Performance | 8.0 | Composited CSS animations, next/image + Sanity, mostly server-rendered. |
| Editorial voice / delight | 8.0 | Tagline, mascot, notes, June-approved seal. Could extend voice into 404/loading. |

---

## What's already strong (keep / don't break)

- The vintage-editorial visual language and the June mascot give it a point of
  view most recipe apps lack.
- Pantry-based discovery is a recognized differentiator (Supercook, Food52) and
  you already have the data for it.
- Optimistic UI on the Plan is the right pattern and feels instant.
- Cook mode already nails the two hardest things: **wake-lock** and large type.

---

## Improvement plan (pick from this)

Each item: the idea, **why** (cited), rough **effort** (S/M/L), and whether it
needs **Framer Motion**.

### Quick wins — high impact, low effort

1. **Interactive ingredient checkboxes on the recipe page** — tap to cross off
   while shopping/cooking; persist in `localStorage` per recipe. _Why:_ SideChef
   ties interactive ingredients/timers to ~42% more engagement; prevents
   re-reading mid-cook. **Effort: S. No FM.**
2. **Step check-off + bigger tap targets in cook mode** — let each step be
   ticked; bump Back/Next to ≥48px hit areas. _Why:_ Drizzlelemons uses 56px
   targets for flour-covered hands. **Effort: S. No FM.**
3. **Serving scaler** — a stepper next to "serves N" that rescales ingredient
   quantities in place; optionally a metric/imperial note. _Why:_ SideChef names
   a missing scaler as a top recipe-UX mistake; NYT Cooking's stepper is the
   reference. **Effort: M (quantity parsing). No FM.**
4. **Facet counts on filters** — show counts beside tags/ingredients
   ("Dinner · 12"). _Why:_ Baymard — counts signal availability and prevent
   zero-result dead-ends. **Effort: S. No FM.**
5. **Editorial polish on functional surfaces** — give 404 + loading the same
   warmth as the empty state (June asleep, a line of voice). _Why:_ Pencil&Paper
   / Toptal — delight feels earned in empty/loading/error, not decoration.
   **Effort: S. FM optional.**

### Medium

6. **Grocery item exit animations** — items animate out when checked/skipped via
   `AnimatePresence`. _Why:_ the one thing CSS can't do (animate removal); motion
   here reads as responsiveness. **Effort: M. Needs FM.**
7. **Add-to-plan feedback** — button swaps to "✓ Added" with a single paw arcing
   toward the Plan link. _Why:_ closes the feedback loop on a key action
   (NN/g visibility-of-system-status). **Effort: M. Light FM.**
8. **Inline timers in cook mode** — detect "25 min" in a step → one-tap
   countdown. _Why:_ Drizzlelemons — removes context-switching at the stove.
   **Effort: M–L. No FM.**
9. **Per-step ingredient highlight in cook mode** — show the ingredients each
   step uses. _Why:_ Drizzlelemons/Flavorish. **Effort: M. No FM.**
10. **"Cook from pantry"** — one tap on the home page pre-applies your pantry as
    the ingredient filter to show what you can make now. _Why:_ Supercook's
    signature pattern; you already store the pantry. **Effort: M. No FM.**

### Larger / strategic

11. **Card → recipe shared-element transition** — the card image morphs into the
    detail hero via `layoutId`. _Why:_ spatial continuity (Motion layout
    animations); the one full-route motion genuinely worth doing. **Effort: M.
    Needs FM.**
12. **Recipe-detail "quick facts" header** — a compact chip row (time · serves ·
    rating · n-ingredients) above the fold. _Why:_ SideChef — front-load the
    facts a cook decides on. **Effort: M. No FM.**
13. **Seasonal / curated collections on home** ("June's quick weeknights").
    _Why:_ editorial voice is the brand and substitutes for crowd ratings
    (HubSpot UX-content). **Effort: M–L. No FM.**
14. **Last-cooked / "made N times" signal on cards** — lightweight personal
    social proof instead of public stars. _Why:_ trust/affinity for a 2-person
    site. **Effort: M. No FM.**

---

## On Framer Motion (honest take)

**Add it — narrowly.** It's only worth the dependency for the things CSS can't
do: `AnimatePresence` exit animations (grocery list, #6) and the optional
`layoutId` card→recipe transition (#11). Everything else (fades, hover, the
drawing rule, confetti) should stay as your existing CSS keyframes, which run on
the compositor thread for free.

Guardrails if we adopt it:
- Use the **`LazyMotion` + `m`** pattern (~4.6 kb initial vs ~34 kb for the full
  import).
- Isolate it in small **client islands** — never the page shell — so the rest
  stays server-rendered.
- Wrap the app once in **`<MotionConfig reducedMotion="user">`** and mirror it in
  CSS `@media (prefers-reduced-motion)` (especially for the paw confetti).
- **Skip global page transitions.** If we ever want them, use Next 16's native
  View Transitions, not the `FrozenRouter` hack.

---

## Suggested first slice (if you want a recommendation)

Highest value for least risk: **#1 ingredient checkboxes, #2 cook-mode step
check-off + targets, #3 serving scaler, #5 editorial 404/loading** — all
no-dependency, all on the screens cooks use most. Then a second slice introduces
Framer Motion for **#6 grocery exits + #7 add-to-plan + #11 card transition** as
one cohesive "motion" pass.
