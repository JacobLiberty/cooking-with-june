# Cooking with June — Design System

> Loaded as context for all UI work. This is a **commitment**, not a menu. When a
> choice isn't covered here, extrapolate from the committed tone — don't retreat
> to defaults. Sharpen what exists; never dilute it back toward "safe."

## Committed tone — Warm vintage editorial

A **warm New Yorker for a home kitchen.** Editorial structure (strong type
hierarchy, hairline rules, drop caps, spot illustrations, generous margins)
rendered in a warm, hand-made, earthy palette. Bold *and* understated: confident
typographic moves and one dominant color, executed with restraint.

**The feeling, in 3 seconds:** *"Wow, that's beautiful — and I think I could
actually pull that recipe off."* Impressive but approachable. Aspirational, never
intimidating. It should read like a treasured printed cookbook someone clearly
cared about, not a SaaS dashboard and not a craft-fair scrapbook.

**Why:** the content is personal and homemade; the craft of the presentation is
what makes it feel *loved*. Editorial polish signals care; warm earthy tones and
June keep it human. Every screen should look composed, like a printed page.

## Typography

Serif-on-serif, the editorial way. Specific families (all via `next/font/google`):

- **Display — `Libre Caslon Display`.** An authentic vintage Caslon display serif —
  clean classic letterforms (no quirky/swash characters), genuinely "printed
  cookbook" / New-Yorker editorial. Headlines, recipe titles, section numbers. Set
  large and tight (`leading-none`/`leading-[1]`), weight 400. (Replaced Fraunces,
  whose WONK axis gave an odd squiggly "J".)
- **Body — `Newsreader`.** Editorial serif designed for screens (Production Type).
  Warm, readable on mobile, Caslon-adjacent. All running text, ingredients, steps.
  Prefer **old-style figures** in prose; **tabular figures** where quantities align
  in a column.
- **Eyebrows / kickers / bylines — `Newsreader`, letter-spaced small-caps**
  (`uppercase tracking-[0.18em] text-[0.7rem]`). Tags, "Serves 4", "Jacob's note".
  This spaced-smallcaps kicker is a recurring signature.
- **Emphasis & June's voice — `Newsreader` *italic***, set small and in `--terracotta`.
  Pull-quotes, "from our kitchen" notes, June's margin asides. **No casual script
  font** — italic carries the personality. (`Caveat` is removed.)

Rules: one display face, one body face — never introduce a third. Drop caps on
recipe intros are encouraged. Numerals are oldstyle in prose.

## Color philosophy

**One dominant, warm paper, sharp warm accent.** Not an evenly-weighted rainbow.
A deep **terracotta** leads (warm, earthy — reads "cooking," and ties to June's
reddish coat); a brighter **clay** terracotta is the spark; everything sits on warm
ecru paper with deep aubergine ink. Declare as CSS variables (mapped into Tailwind
v4 `@theme`):

```css
/* Ground & ink */
--paper:           #faf4ea; /* warm ecru newsprint — the canvas */
--paper-sunk:      #f1e8d8; /* recessed panels, table stripes */
--ink:             #2b2230; /* deep aubergine-plum — text, never pure black */
--ink-soft:        #6b5d6a; /* secondary text, captions */

/* Dominant — terracotta (the brand color; deep enough for AA text on ecru) */
--terracotta:      #a04a28; /* headers, rules, links, active state */
--terracotta-deep: #79361d; /* hover/pressed, strong emphasis */
--terracotta-wash: #f1ddca; /* tints, quiet backgrounds, chips */

/* Sharp accent — clay (the brighter spark; used sparingly, with intent) */
--clay:            #c8743c; /* CTAs, the "made it" mark, ingredient chips */
--clay-wash:       #f3dcc8;

/* Tertiary (rare, supporting) */
--ochre:           #d99a32; /* tiny highlights, star ratings */
```

Usage discipline: **terracotta dominates, clay punctuates.** A screen is mostly
paper + ink + terracotta, with clay appearing once or twice as the eye's target.
Ochre is seasoning. No green anywhere. Pure white and pure black are banned — warm
ecru and aubergine ink instead.

## Motion philosophy

**One well-choreographed moment per view, not scattered micro-interactions.**

- **Signature: the "page sets" load.** On a recipe/page load, content composes
  like a printed page being laid down — a brief staggered fade-and-rise: kicker →
  title → the hairline rule *drawing* in horizontally → body. Use
  `animation-delay` steps (~60–90ms apart), small travel (8–12px), ~400ms,
  ease-out. CSS-only where possible; Motion (React) only if a view needs it.
- Everything else is **quiet**: links/buttons get a calm color shift and the rule
  underline, nothing bouncy. Respect `prefers-reduced-motion` (disable the stagger).
- No parallax, no scattered hover wiggles, no spinner theater. The reward is the
  composed page, not confetti.

## Spatial composition

Compose like a magazine, optimized for the phone first.

- **Strong hierarchy & generous margins.** Let titles be large; let paper breathe.
  Asymmetry over dead-centered everything.
- **Hairline rules (`--terracotta`, ~1px)** separate sections — a core editorial
  device. Use them instead of boxes/shadows wherever possible.
- **Mobile-first, single column.** Big readable Newsreader, comfortable measure
  (~38–42rem max on desktop). On a recipe: a clear lede image, drop-capped intro,
  ingredients as a tabular-figure list, numbered steps with prominent step numerals
  (Caslon). Desktop may introduce a sidebar/asymmetric column for meta, but never
  at the cost of the mobile read.
- **Captioned imagery**, editorial-style — small spaced-smallcaps captions under
  photos. Images get a thin ink keyline, not a drop shadow.
- Baseline-ish rhythm; align to a consistent spacing scale.

## June & brand expression (the differentiation)

June is the soul, applied with editorial restraint — **tasteful nods, never a
mascot parade.** The thing a friend remembers and describes.

- **Who June is:** a cute **male brown tabby** rendered kawaii/chibi (Sanrio-ish) —
  a warm **reddish chestnut** coat with darker stripes and a ringed tail, lighter
  **tan** face/belly, whiskers, happy closed "^^" eyes and a content smile. Reads
  instantly as a cat; simple and adorable, not detailed.
- **Art style:** **AI-generated** flat kawaii mascot illustrations — simple, very
  rounded, clean outlines, completely flat color (no gradients/shading/detail).
  Generated on the `#faf4ea` paper background and **cropped** (no cutout): on the
  app they sit on matching paper, so no rectangle shows. (Raster PNGs in
  `public/june/`, not hand-drawn SVGs.)
- **Signature devices:** **chef-hat June peeking** over the home rule, and **June
  lying down as a horizontal page divider.**
- **Pose set → placement (one per view):** chef-hat **peek** → home header ·
  **loaf** → masthead logo + About hero · **sleeping** → empty states ·
  **lying-down divider** → recipe detail · **mid-bat** → 404.
- **Logo / favicon:** the **loaf** pose, centered on a rounded paper tile.
- **Pawprint** as a quiet recurring device: list bullet, the "made it" stamp (in
  terracotta), loading, 5★ confetti. Small, never loud.
- **Voice:** June appears in microcopy **lightly and undertoned** — small fun bits
  here and there (empty states, loading), never heavy. Written asides use Newsreader
  italic in terracotta (see Typography).

## Icons & assets

- **No emoji anywhere in the UI or brand.** (Replaces the current 🐱/🐾
  placeholders.)
- **Icon library: Phosphor (`@phosphor-icons/react`), `light` or `regular`
  weight** — thin editorial linework that matches the spot illustrations.
  Tree-shake (import individual icons) to stay light.
- **Custom assets** (June illustrations, pawprint, masthead ornaments) are
  generated SVG/PNG line art kept consistent in stroke weight and style; stored in
  `public/` and documented as they're created. Delete the leftover scaffold SVGs
  (`next.svg`, `vercel.svg`, etc.).

## Performance & constraints

- **Fast & light, mobile-first.** Subset fonts; lazy/responsive images via
  `next/image` + Sanity transforms; per-icon imports; CSS-only motion by default.
- Accessible: AA contrast (aubergine ink on ecru passes; verify terracotta and clay
  on paper for text use), focus-visible states, `prefers-reduced-motion` honored,
  semantic landmarks.
- Light theme is the canonical home; no dark mode for v1 (the warm paper *is* the
  brand). Editing happens on desktop, reading mostly on phones — both must feel
  composed.

## NEVER do this (anti-slop)

- **No decorative *gradients*** — flat, confident editorial color only. No
  gradient meshes, no purple-gradient-on-white clichés. (Terracotta is a flat ink.)
- **No `Inter`, `Roboto`, `Arial`, `Helvetica`, or system-default fonts.** No
  defaulting to `Space Grotesk`/`Poppins` either. Display is Libre Caslon Display,
  body is Newsreader.
- **No emoji as UI or brand.** Icons + custom line art only.
- **No generic glassmorphism**, frosted blur panels, or neumorphism.
- **No bento-grid sameness** / identical rounded drop-shadow cards in a uniform
  matrix. Use rules, hierarchy, and asymmetry instead of card soup.
- **No timid, evenly-distributed palette.** Terracotta dominates; terracotta
  punctuates. No "5 tints at equal weight."
- **No pure white `#fff` or pure black `#000`.** Warm ecru + aubergine ink.
- **No centered-everything**, no dead-symmetrical hero with a subhead and two
  buttons. Compose editorially.
- **No drop-shadow-on-everything**, no heavy 3D buttons, no spinner/skeleton
  theater, no scattered hover wiggles. Quiet motion, one choreographed moment.
- **No mascot overload** — June is a restrained nod, not stickers on every corner.
