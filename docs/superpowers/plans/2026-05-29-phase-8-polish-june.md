# Cooking with June — Phase 8: Polish + June Character Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development or executing-plans. Checkbox steps; TDD where marked.

**Goal:** Bring June's personality through the editorial design with restraint — a peeking line-art June on the masthead, a curled June in empty states + a playful 404, a pawprint loading animation, a small pawprint "confetti" on a 5★ rating, a proper About page, and a June favicon. One June moment per view, never a mascot parade.

**Architecture:** Custom minimal line-art SVG components (`JunePeek`, `JuneCurled`) in `currentColor` so they inherit palette tokens. A `PawTrail` loading animation reused by route `loading.tsx` files. A tiny pure `shouldCelebrate()` gates the 5★ paw-confetti in `EditorActions`. All additive + design.md-compliant (heather/clay, Fraunces/Newsreader, no emoji).

**Tech Stack:** Next.js 16 App Router (loading.tsx, not-found.tsx, app/icon.svg), CSS animation, Vitest.

**Design contract:** `design.md` — June art is New-Yorker-style minimal ink linework in clay/ink; pawprints quiet; motion respects `prefers-reduced-motion`. No emoji.

## Conventions
- App code uses `@/`. Don't touch `src/sanity/env.ts`, `sanity.config.ts`, `sanity.cli.ts`, `.env*`.

## File Structure
Created:
- `src/components/june.tsx` — `JunePeek`, `JuneCurled` line-art components
- `src/components/paw-trail.tsx` — walking-paws loading animation
- `src/lib/celebrate.ts` + `.test.ts` — `shouldCelebrate()` (TDD)
- `src/app/(site)/loading.tsx` — collection loading state
- `src/app/(site)/recipe/[slug]/loading.tsx` — recipe loading state
- `src/app/not-found.tsx` — playful 404
- `src/app/icon.svg` — June/paw favicon
Modified:
- `src/components/site-header.tsx` — `JunePeek` peeking over the masthead rule
- `src/components/collection-view.tsx` — `JuneCurled` in the empty state
- `src/components/editor-actions.tsx` — paw-confetti burst on 5★
- `src/app/(site)/about/page.tsx` — flesh out with a June spot + story
- `src/app/globals.css` — confetti + paw-trail keyframes (reduced-motion safe)

---

## Task 1: June line-art components

- [ ] **Step 1: `src/components/june.tsx`**
```tsx
/** Minimal line-art June — inherits color via currentColor. Decorative. */
export function JunePeek({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 34" className={className} aria-hidden fill="none">
      {/* ears */}
      <path d="M20 14 L15 3 L29 9 Z" fill="currentColor" />
      <path d="M60 14 L65 3 L51 9 Z" fill="currentColor" />
      {/* head dome rising over the baseline */}
      <path
        d="M12 34 C12 18 24 9 40 9 C56 9 68 18 68 34"
        stroke="currentColor"
        strokeWidth="2.4"
        strokelinecap="round"
      />
      {/* eyes */}
      <circle cx="32" cy="22" r="2.4" fill="currentColor" />
      <circle cx="48" cy="22" r="2.4" fill="currentColor" />
      {/* nose + whiskers */}
      <path d="M40 26 l-2.5 2 M40 26 l2.5 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M30 28 l-9 -1 M30 30 l-9 2 M50 28 l9 -1 M50 30 l9 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export function JuneCurled({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 80" className={className} aria-hidden fill="none">
      {/* curled body */}
      <path
        d="M18 56 C12 30 40 16 66 22 C92 28 104 50 92 64 C82 75 40 76 30 64"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* ear */}
      <path d="M60 22 L58 10 L70 17 Z" fill="currentColor" />
      {/* tail curl */}
      <path d="M92 64 C104 64 110 52 100 46" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      {/* closed sleepy eye */}
      <path d="M64 34 q4 4 9 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
```
> Fix any casing the renderer rejects: use `strokeLinecap` (camelCase) consistently — correct the `strokelinecap` typo in JunePeek's head path to `strokeLinecap`.

- [ ] **Step 2:** `npx tsc --noEmit`. Commit: `git add src/components/june.tsx && git commit -m "feat: minimal line-art June components (peek, curled)"`

---

## Task 2: shouldCelebrate (TDD)

- [ ] **Step 1: Test `src/lib/celebrate.test.ts`**
```ts
import { describe, it, expect } from "vitest";
import { shouldCelebrate } from "@/lib/celebrate";

describe("shouldCelebrate", () => {
  it("celebrates only a perfect 5", () => {
    expect(shouldCelebrate(5)).toBe(true);
    expect(shouldCelebrate(4.5)).toBe(false);
    expect(shouldCelebrate(0)).toBe(false);
  });
});
```
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: `src/lib/celebrate.ts`**
```ts
export function shouldCelebrate(value: number): boolean {
  return value === 5;
}
```
- [ ] **Step 4:** PASS. Commit: `git add src/lib/celebrate.ts src/lib/celebrate.test.ts && git commit -m "feat: shouldCelebrate helper"`

---

## Task 3: Motion keyframes (paw-trail + confetti)

- [ ] **Step 1: Append to `src/app/globals.css`** (after the existing motion block):
```css
/* ── Paw-trail loading + 5★ paw confetti ───────────────────────────── */
@keyframes paw-step {
  0%, 100% { opacity: 0.2; }
  50% { opacity: 1; }
}
.paw-step {
  animation: paw-step 1s ease-in-out infinite;
}
.paw-step-1 { animation-delay: 0s; }
.paw-step-2 { animation-delay: 0.15s; }
.paw-step-3 { animation-delay: 0.3s; }
.paw-step-4 { animation-delay: 0.45s; }

@keyframes paw-pop {
  0% { opacity: 0; transform: translateY(0) scale(0.5) rotate(var(--r, 0deg)); }
  30% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-40px) scale(1) rotate(var(--r, 0deg)); }
}
.paw-pop {
  animation: paw-pop 0.9s ease-out forwards;
}

@media (prefers-reduced-motion: reduce) {
  .paw-step { animation: none; opacity: 0.6; }
  .paw-pop { animation: none; opacity: 0; }
}
```
- [ ] **Step 2:** Commit: `git add src/app/globals.css && git commit -m "feat: paw-trail and confetti keyframes (reduced-motion safe)"`

---

## Task 4: PawTrail + route loading states

- [ ] **Step 1: `src/components/paw-trail.tsx`**
```tsx
import { PawMark } from "@/components/paw-mark";

export function PawTrail({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-24" role="status" aria-live="polite">
      <div className="flex items-end gap-2">
        {[1, 2, 3, 4].map((n) => (
          <PawMark
            key={n}
            className={`paw-step paw-step-${n} h-5 w-5 text-clay ${n % 2 === 0 ? "translate-y-1" : ""}`}
          />
        ))}
      </div>
      <span className="kicker text-ink-soft">{label}</span>
    </div>
  );
}
```
- [ ] **Step 2: `src/app/(site)/loading.tsx`**
```tsx
import { PawTrail } from "@/components/paw-trail";
export default function Loading() {
  return <PawTrail label="Setting the table…" />;
}
```
- [ ] **Step 3: `src/app/(site)/recipe/[slug]/loading.tsx`**
```tsx
import { PawTrail } from "@/components/paw-trail";
export default function Loading() {
  return <PawTrail label="Fetching the recipe…" />;
}
```
- [ ] **Step 4:** Commit: `git add src/components/paw-trail.tsx "src/app/(site)/loading.tsx" "src/app/(site)/recipe/[slug]/loading.tsx" && git commit -m "feat: pawprint loading states"`

---

## Task 5: Playful 404

- [ ] **Step 1: `src/app/not-found.tsx`** (root-level — gets the bare root layout)
```tsx
import Link from "next/link";
import { JuneCurled } from "@/components/june";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-5 text-center">
      <JuneCurled className="h-24 w-36 text-clay" />
      <p className="kicker mt-6 text-heather">404</p>
      <h1 className="editorial-display mt-2 text-4xl text-ink md:text-5xl">
        June knocked this page off the counter
      </h1>
      <p className="mt-4 text-ink-soft">
        It isn&rsquo;t where it used to be. Let&rsquo;s get you back to the kitchen.
      </p>
      <Link
        href="/"
        className="kicker mt-6 border border-heather px-4 py-2 text-heather hover:bg-heather-wash"
      >
        Back to the collection
      </Link>
    </main>
  );
}
```
> Note: this root `not-found.tsx` renders inside the bare root layout (no site chrome), which is appropriate for a full-screen 404. The home/recipe `notFound()` calls will use it.

- [ ] **Step 2:** Commit: `git add src/app/not-found.tsx && git commit -m "feat: playful June 404 page"`

---

## Task 6: June on the masthead + empty state + About

- [ ] **Step 1: `src/components/site-header.tsx`** — add `JunePeek` peeking over the bottom rule. Wrap the header content so June sits at the bottom edge:
  - import `{ JunePeek } from "@/components/june"`
  - Add, just before the closing `</header>`, an absolutely-positioned peek at the left of the masthead rule:
    ```tsx
    <JunePeek className="pointer-events-none absolute bottom-0 left-6 h-5 w-12 translate-y-px text-clay/80" />
    ```
  - Ensure the `<header>` has `relative` and keeps `overflow-visible` (default). Add `relative` to the header className.

- [ ] **Step 2: `src/components/collection-view.tsx`** — replace the `PawMark` in the empty state with `JuneCurled` for a warmer "nothing here":
  - import `{ JuneCurled } from "@/components/june"`
  - swap `<PawMark className="h-8 w-8 text-clay/70" />` for `<JuneCurled className="h-20 w-28 text-clay/70" />`
  - keep the heading/hint copy.

- [ ] **Step 3: Flesh out `src/app/(site)/about/page.tsx`** — keep it editorial; add a June spot and a short story (no emoji):
```tsx
import type { Metadata } from "next";
import { JunePeek } from "@/components/june";

export const metadata: Metadata = {
  title: "About · Cooking with June",
};

export default function AboutPage() {
  return (
    <section className="mx-auto max-w-2xl py-8 md:py-16">
      <p className="kicker set set-1 text-heather">About</p>
      <h1 className="editorial-display set set-2 mt-3 text-5xl text-ink md:text-6xl">
        About June
      </h1>
      <div className="rule-draw mt-5 h-px w-full bg-heather/40" />
      <div className="set set-3 mt-8 flex justify-center">
        <JunePeek className="h-12 w-28 text-clay" />
      </div>
      <p className="dropcap set set-3 mt-6 text-lg leading-relaxed text-ink">
        June is our orange cat and self-appointed head of the kitchen. He
        supervises from the windowsill, inspects every grocery haul, and has
        strong opinions about anything involving butter.
      </p>
      <p className="mt-5 leading-relaxed text-ink">
        This is the cookbook Jacob &amp; Lily are building around him — a warm,
        well-kept place for the meals worth making twice. Recipes get a photo, a
        story, the ingredients we actually used, and our honest ratings, so the
        good ones are easy to find again.
      </p>
      <p className="editorial-aside mt-6 text-xl text-heather">
        Made with care, and supervised with suspicion. — J &amp; L (and June)
      </p>
    </section>
  );
}
```
- [ ] **Step 4: Verify** env-prefixed `npm run build`, `npm test`, `npm run lint`, `npx tsc --noEmit`. Commit: `git add src/components/site-header.tsx src/components/collection-view.tsx "src/app/(site)/about/page.tsx" && git commit -m "feat: June on masthead, empty state, and About page"`

---

## Task 7: Paw-confetti on 5★

- [ ] **Step 1: Edit `src/components/editor-actions.tsx`** — when the editor sets 5 stars, show a brief paw burst:
  - imports: `{ shouldCelebrate } from "@/lib/celebrate"`, `{ PawMark } from "@/components/paw-mark"`, and `useState` already present.
  - add state: `const [celebrate, setCelebrate] = useState(false);`
  - in `rate(v)`: after setting, `if (shouldCelebrate(v)) { setCelebrate(true); setTimeout(() => setCelebrate(false), 900); }`
  - render a burst overlay near the stars when `celebrate`:
    ```tsx
    {celebrate ? (
      <span className="pointer-events-none relative" aria-hidden>
        {[-20, -8, 6, 18].map((x, i) => (
          <PawMark
            key={i}
            className="paw-pop absolute h-4 w-4 text-clay"
            style={{ left: `${x}px`, ["--r" as string]: `${x * 2}deg` }}
          />
        ))}
      </span>
    ) : null}
    ```
  - (PawMark already accepts `className`; add a `style` passthrough to `PawMark` if it doesn't have one — update `paw-mark.tsx` to accept an optional `style?: React.CSSProperties` prop and spread it on the `<svg>`.)
- [ ] **Step 2: Update `src/components/paw-mark.tsx`** to accept and spread an optional `style` prop.
- [ ] **Step 3: Verify** `npm test`, `npm run build`, `npm run lint`, `npx tsc`. Commit: `git add src/components/editor-actions.tsx src/components/paw-mark.tsx && git commit -m "feat: paw-confetti burst on a 5-star rating"`

---

## Task 8: June favicon

- [ ] **Step 1: `src/app/icon.svg`** (Next serves this as the favicon):
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#faf4ea"/>
  <g fill="#c8743c">
    <ellipse cx="16" cy="20" rx="5.5" ry="4.6"/>
    <ellipse cx="8" cy="13.5" rx="2.4" ry="3"/>
    <ellipse cx="13" cy="9.5" rx="2.4" ry="3"/>
    <ellipse cx="19" cy="9.5" rx="2.4" ry="3"/>
    <ellipse cx="24" cy="13.5" rx="2.4" ry="3"/>
  </g>
</svg>
```
- [ ] **Step 2:** Remove the default `src/app/favicon.ico` if present (so the SVG icon is used): `git rm src/app/favicon.ico` (if it exists). Verify build still fine.
- [ ] **Step 3:** Commit: `git add src/app/icon.svg && git commit -m "feat: June pawprint favicon"`

---

## Task 9: Final phase gate + full-suite review
- [ ] `npm test` (prior 59 + celebrate 1 = 60), `npm run lint` (0), `npx tsc --noEmit`, `npm audit` (0), env-prefixed `npm run build`. Report.

---

## Self-Review
**Spec coverage (Phase 8: June art set, pawprint loading, confetti, About, playful 404, responsive/polish):** June line-art (JunePeek/JuneCurled) on masthead/empty/About/404 ✓; pawprint loading (PawTrail + loading.tsx) ✓; 5★ paw-confetti ✓; About fleshed out ✓; playful 404 ✓; June favicon ✓.
**Design.md:** minimal ink linework in clay/ink (currentColor), heather/Fraunces/Newsreader, reduced-motion honored, one June moment per view, no emoji.
**Restraint:** masthead peek (subtle), empty-state curl, About spot, 404 curl, confetti only on a perfect 5 — not everywhere.
**Placeholders:** none. (June art is intentionally minimal line-art; richer generated illustrations can replace these components later via the same API.)
**Type consistency:** `shouldCelebrate(value:number)` matches EditorActions usage; `PawMark` gains an optional `style` prop used by the confetti.
**Risks:** hand-authored SVG cats are simple/minimal by design — if they read as too crude, they can be swapped for generated art later without API changes (same component names). Confetti uses a CSS var `--r` via inline style — ensure the `style` prop is typed to allow custom properties (cast as shown).
