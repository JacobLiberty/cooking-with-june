# Cooking with June — Design Spec

**Date:** 2026-05-29
**Status:** Approved (design); pending implementation planning

## Overview

A personal, shareable digital recipe book for Jacob and Lily (and invited
friends), themed around their orange/brown cat **June**. The feel: a pastel,
homemade-but-painstakingly-crafted cookbook — personal and polished. Public
visitors can browse; a managed set of editors can add, edit, and rate recipes
from within the app.

## Goals

- Browse, search, filter, and sort a collection of recipes.
- Add/edit recipes **in-app** (no leaving the site for everyday actions), backed
  by Sanity, with Sanity Studio available as a power tool.
- A standout **pantry filter**: pick ingredients on hand and find matching recipes.
- Per-editor ratings so each person tracks what they thought.
- A warm, characterful UI with June woven throughout.

## Non-Goals (v1)

- No separate/self-hosted database (Sanity is the content store).
- No public sign-ups, comments, or social features.
- No meal planning, shopping lists, or nutrition data (possible future work).
- No native mobile app (responsive web only).

## Tech Stack & Architecture

- **Framework:** Next.js (App Router) + TypeScript, deployed on **Vercel**.
- **Content store:** **Sanity** (hosted, free tier). Holds recipes, photos,
  ingredients, tags, editors, and ratings. No separate database to run.
- **Styling:** **Tailwind CSS** with a custom pastel theme (palette as design
  tokens) plus hand-built components.
- **Auth:** **Auth.js (NextAuth v5)** with **Google sign-in**. Authorization is
  checked against a Sanity-managed editor allowlist (see below).
- **Reads:** public, via Sanity's CDN (cached, fast).
- **Writes:** via **Next.js server actions** using a secret Sanity **write
  token** (server-only, never shipped to the browser), gated by editor auth.
- **Editing model (Approach B — Hybrid):** lightweight in-app forms for everyday
  actions (rate, "made it", wishlist, add/edit recipe) + **embedded Sanity Studio
  at `/studio`** (editor-only) for power editing and managing the editor list.
- **Images:** Sanity image pipeline (`@sanity/image-url`) + `next/image` for
  responsive, optimized photos.

### Palette (design tokens)

Cream `#FFF8F0` · soft terracotta `#F3C6A8` · pastel sage `#BFD8B8` · soft
butter `#F7D9A0` · apricot accent `#E8A87C` · warm-brown text `#6B5D4F`. Serif
body type with a handwritten accent font for titles and notes.

## Data Model (Sanity schemas)

### `recipe`
- `title` (string, required)
- `slug` (slug, required, from title)
- `description` (short text)
- `story` (optional "from our kitchen" blurb)
- `images[]` (image, at least one required; first is the cover)
- `ingredients[]` — each line: `{ quantity, unit, ingredient → reference(ingredient), note }`
- `steps[]` — ordered array of step text (block/string)
- `prepTime`, `cookTime` (minutes), `servings` (number)
- `tags[]` — array of references to `tag`
- `ratings[]` — `{ editor → reference(editor), value (0–5, 0.5 steps) }`
- `wishlist` (boolean — "to-try")
- `madeCount` (number), `lastMadeAt` (datetime)
- `notes[]` — optional personal notes `{ author?, text }`
- `createdAt` (datetime — used for "date added" sort)

### `ingredient`
- `name` (string, required, unique)
- `category` (optional string — e.g. produce, protein, pantry)

Normalized so the pantry filter is typo-free and "ground beef" is one canonical
entity across recipes. Recipes **reference** ingredients rather than storing free
text — this is what makes the ANY/ALL filter reliable.

### `tag`
- `name` (string), `slug` (slug). Categories such as dinner, dessert, quick,
  vegetarian.

### `editor`
- `name` (string), `email` (string, matches Google account email)

The set of `editor` documents is the authorization allowlist. Managed via Studio
(add/remove docs); no redeploy needed.

## Authorization Model

- **Public visitor:** browse, search, filter, sort, view recipes and cook mode.
- **Editor** (email present in an `editor` doc): everything above + add/edit
  recipes, rate, "made it", wishlist toggle, manage editors via Studio.
- On sign-in, Auth.js resolves the Google email; the app checks it against the
  editor allowlist in Sanity to grant editor capabilities.
- **Every write (server action) re-checks** that the session email is a current
  editor, so revoking access takes effect immediately.
- **Bootstrap:** seed Jacob as the first editor on setup to avoid lockout.

### Ratings

Per-editor: each editor gets their own ★ rating on a recipe (`ratings[]`),
displayed by name (e.g. "Jacob ★★★★, Lily ★★★★½"), with a combined average used
for the rating sort. Covers "one for me, one for Lily" and extends to invited
friends.

## Pages & Features

- **Home `/`** — recipe card grid (June peeks over cards; polaroid framing).
  Controls: search by name; **pantry ingredient filter** (multi-select with
  **ANY/ALL toggle**); tag filter; **sort** (name [default] · rating · date
  added); wishlist ("to-try") filter; **Surprise me** (random recipe). Filter and
  sort state stored in the **URL** (shareable/bookmarkable). June-themed empty
  state when nothing matches.
- **Recipe detail `/recipe/[slug]`** — cover + photos, description, story/notes,
  meta (prep/cook time, servings, tags), ingredients, numbered steps, per-editor
  ratings (editable when logged in), 🐾 "made it" (increments count, sets
  last-made), wishlist toggle, Cook mode entry.
- **Cook mode `/recipe/[slug]/cook`** — big-text step-by-step; screen kept awake
  (Wake Lock API); pawprint progress.
- **Add / Edit `/recipe/new` & `/recipe/[slug]/edit`** — editor-only in-app forms:
  title, description, story, photo upload, ingredient lines with autocomplete
  (create new ingredient inline), steps, times, servings, tags.
- **About `/about`** — story of June and the kitchen; most June-decorated page.
- **Studio `/studio`** — embedded Sanity Studio (editor-only) for power editing
  and managing the editor list.
- **Auth routes** + a playful **404** ("June knocked this page off the counter").

## Look & Feel — June touches

- June **peeking** over the home header, empty states, and About page.
- **Pawprints** as section dividers, the "made it" stamp, and a **walking-paws
  loading animation**.
- **Confetti pawprints** on a 5★ rating.
- **Polaroid/scrapbook** photo framing (slight tilt, tape corners).
- **Mobile-first / responsive** (e.g. Lily adding a recipe from her phone).
- June art produced as a small consistent PNG set (peeking, sitting, pawprint,
  sleeping). Generated directly or via nano-banana-2 prompts.

## Error Handling & Validation

- **Boundaries:** Sanity schema validation (required title, ≥1 image, rating in
  0–5) plus form-level checks before write.
- Server actions reject writes from non-editors with a clear, on-theme message.
- Friendly, themed error/empty/retry states — never raw errors surfaced to users.
- Image upload failures handled explicitly.
- Secrets (Sanity write token, auth secrets) only in server env (Vercel),
  never in client bundles.

## Testing Strategy (TDD)

- **Unit (pure logic):** pantry filter (ANY/ALL), sort comparators (name /
  rating-average / date), rating average, GROQ query builders.
- **Component (React Testing Library):** filter UI, rating control, recipe card,
  search box.
- **E2E (Playwright):** happy path — browse → filter → open recipe → rate.
- Target 80%+ coverage on logic.

## Phased Delivery Roadmap

Each phase is an independently shippable slice, sized to go through the normal
ticket workflow (branch → TDD → review) on its own. Order is dependency-driven.

1. **Foundation & scaffolding** — Next.js + TypeScript + Tailwind project,
   pastel theme tokens, base layout/nav, Vercel deploy, repo hygiene.
2. **Sanity backend** — create project/dataset, define `recipe` / `ingredient` /
   `tag` / `editor` schemas, deploy Studio at `/studio`, seed sample data.
3. **Browse & view (read-only)** — home grid, recipe detail page, Sanity reads
   via CDN, responsive cards with polaroid framing. (Publicly useful on its own.)
4. **Search, filter & sort** — name search, pantry ingredient filter (ANY/ALL),
   tag filter, sort options, URL-state, Surprise me, June empty states.
5. **Auth & editor allowlist** — Auth.js + Google, Sanity-backed editor check,
   bootstrap first editor, gated routes.
6. **In-app editing & ratings** — server-action writes with write token,
   add/edit recipe forms, per-editor ratings, "made it", wishlist toggle.
7. **Cook mode** — fullscreen step-by-step + Wake Lock + pawprint progress.
8. **Polish & June character** — June art set, pawprint loading + confetti,
   handwritten accents, About page, playful 404, final responsive pass.

## Open Questions / Future Work

- Optional in-app "People" admin page (vs. managing editors only in Studio).
- Possible future: meal planning, shopping lists, recipe import from a URL.
