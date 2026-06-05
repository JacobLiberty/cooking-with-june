# Product

## Register

product

## Users

Jacob and his girlfriend Lily, plus a small set of invited friends, and anyone they share a link with. Two modes of use:

- **Editors** (Jacob, Lily, invited friends on the Sanity allowlist): add, edit, rate, and mark recipes as made. Editing mostly happens on desktop, but Lily often adds or references recipes from her phone.
- **Public visitors**: browse, search, filter, and cook from recipes via a shared link. No sign-up.

The dominant context is a phone in a kitchen: finding something to cook, then following it hands-busy while cooking.

## Product Purpose

A personal, shareable digital cookbook themed around their cat June. It replaces scattered screenshots and bookmarks with one warm, well-made collection. Success looks like: the recipes Jacob and Lily actually cook live here, it's a pleasure to browse, the pantry filter ("what can I make with what I have") gets used, and cook mode is genuinely usable at the stove.

## Brand Personality

Warm, editorial, homemade-but-crafted. Voice in three words: **warm, composed, characterful.** It should feel like a treasured printed cookbook someone cared about — a "warm New Yorker for a home kitchen" — not a SaaS dashboard and not a craft-fair scrapbook. June (a kawaii brown tabby) is the soul, applied with restraint: tasteful nods, never a mascot parade. Emotional goal in three seconds: "that's beautiful, and I think I could actually pull that recipe off." Aspirational, never intimidating.

## Anti-references

- SaaS dashboards / admin-tool chrome (the design must not read as a tool).
- Generic AI aesthetic: decorative gradients, glassmorphism, bento-grid card soup, identical drop-shadow card matrices, centered-everything heroes with a subhead and two buttons.
- Craft-fair scrapbook / overdone cutesy mascot stickers on every corner.
- Default fonts (Inter, Roboto, system-ui), emoji as UI, pure white/black, evenly-distributed "5 tints at equal weight" palettes.

## Design Principles

1. **Composed like a printed page.** Strong type hierarchy, hairline terracotta rules instead of boxes/shadows, generous margins, editorial asymmetry. One display face (Libre Caslon Display) + one body face (Newsreader), never a third.
2. **Terracotta dominates, clay punctuates.** One dominant warm color on warm ecru paper with aubergine ink; the brighter clay accent appears once or twice per screen as the eye's target. No green, no pure white/black.
3. **Mobile-first read.** The phone-in-kitchen view is canonical; desktop may add an asymmetric meta column but never at the cost of the mobile read. Light theme only for v1 — the warm paper is the brand.
4. **One choreographed moment per view.** The "page sets" load (kicker → title → rule drawing in → body), everything else quiet. No spinner theater, no scattered hover wiggles. Always honor reduced-motion.
5. **June with restraint.** A remembered, described detail — peek over the home rule, lying-down divider, pawprint "made it" stamp — never overload.

## Accessibility & Inclusion

WCAG AA target: body text ≥4.5:1 on the ecru paper (aubergine ink passes; terracotta and clay must be verified before use as text). `focus-visible` states on all interactive elements, semantic landmarks and heading order, and `prefers-reduced-motion` honored (the page-sets stagger disables). Cook mode must be usable hands-busy: large text, screen kept awake. Touch targets ≥44px for the phone-in-kitchen context. Meaning never by color alone.
