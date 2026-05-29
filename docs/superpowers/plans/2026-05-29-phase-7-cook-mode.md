# Cooking with June — Phase 7: Cook Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development or executing-plans. Checkbox steps; TDD where marked.

**Goal:** A focused, big-text, step-by-step cooking view at `/recipe/[slug]/cook` that keeps the screen awake (Wake Lock API), shows pawprint progress through the steps, lets you peek the ingredients, and is reachable from a "Cook mode" link on the recipe page.

**Architecture:** A server page fetches the recipe (reusing `RECIPE_QUERY`) and renders a client `CookMode` island that manages the current-step state and the screen wake lock (a small `useWakeLock` hook that degrades gracefully when unsupported). A pure `cookProgress` helper (clamp + completed count) is unit-tested; step navigation is covered by a component test (Wake Lock mocked).

**Tech Stack:** Next.js 16 App Router (client island), Wake Lock API, Vitest + RTL.

**Design:** `design.md` — big Fraunces step numerals + Newsreader step text on warm paper; pawprint progress via `PawMark` (clay = done, ink/20 = remaining); quiet controls (kicker buttons); a clear "Exit" back to the recipe. No emoji.

## Conventions
- App code uses `@/`. Don't touch `src/sanity/env.ts`, `sanity.config.ts`, `sanity.cli.ts`, `.env*`.

## File Structure
Created:
- `src/lib/cook-progress.ts` + `.test.ts` — `cookProgress()` (TDD)
- `src/lib/use-wake-lock.ts` — `useWakeLock()` client hook (graceful, no-op when unsupported)
- `src/components/cook-mode.tsx` + `.test.tsx` — client step-through UI
- `src/app/(site)/recipe/[slug]/cook/page.tsx` — server page
Modified:
- `src/app/(site)/recipe/[slug]/page.tsx` — add a "Cook mode" link

---

## Task 1: cookProgress (TDD)

- [ ] **Step 1: Test `src/lib/cook-progress.test.ts`**
```ts
import { describe, it, expect } from "vitest";
import { cookProgress } from "@/lib/cook-progress";

describe("cookProgress", () => {
  it("reports completed count and clamps the index", () => {
    expect(cookProgress(0, 5)).toEqual({ current: 0, total: 5, completed: 0, isLast: false });
    expect(cookProgress(2, 5)).toEqual({ current: 2, total: 5, completed: 2, isLast: false });
    expect(cookProgress(4, 5)).toEqual({ current: 4, total: 5, completed: 4, isLast: true });
  });
  it("clamps out-of-range indices", () => {
    expect(cookProgress(-3, 5).current).toBe(0);
    expect(cookProgress(99, 5).current).toBe(4);
  });
  it("handles zero steps", () => {
    expect(cookProgress(0, 0)).toEqual({ current: 0, total: 0, completed: 0, isLast: true });
  });
});
```
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: `src/lib/cook-progress.ts`**
```ts
export type CookProgress = {
  current: number;
  total: number;
  completed: number;
  isLast: boolean;
};

export function cookProgress(index: number, total: number): CookProgress {
  if (total <= 0) return { current: 0, total: 0, completed: 0, isLast: true };
  const current = Math.min(Math.max(index, 0), total - 1);
  return {
    current,
    total,
    completed: current,
    isLast: current >= total - 1,
  };
}
```
- [ ] **Step 4:** PASS. Commit: `git add src/lib/cook-progress.ts src/lib/cook-progress.test.ts && git commit -m "feat: cookProgress helper"`

---

## Task 2: useWakeLock hook (graceful)

- [ ] **Step 1: `src/lib/use-wake-lock.ts`**
```ts
"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps the screen awake while mounted, using the Wake Lock API.
 * No-ops gracefully where unsupported (older Safari, insecure contexts).
 * Re-acquires the lock when the tab becomes visible again.
 */
export function useWakeLock(active: boolean = true) {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    async function acquire() {
      try {
        if （typeof navigator === "undefined") return;
        if (!("wakeLock" in navigator)) return;
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await sentinel.release().catch(() => {});
          return;
        }
        lockRef.current = sentinel;
      } catch {
        // permission denied / not allowed — silently degrade
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible" && !lockRef.current) {
        void acquire();
      }
    }

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [active]);
}
```
> NOTE: the line `if （typeof navigator...` above uses a full-width paren by mistake in this plan text — implement it as a normal ASCII `if (typeof navigator === "undefined") return;`. Use standard ASCII parentheses throughout.

- [ ] **Step 2:** `npx tsc --noEmit` — if `WakeLockSentinel`/`navigator.wakeLock` types are missing, add `"dom"` is already in lib; the Wake Lock types ship with TS `lib.dom`. If the installed TS lacks them, type `lockRef` as `any | null` with an eslint-disable and report. Commit: `git add src/lib/use-wake-lock.ts && git commit -m "feat: graceful useWakeLock hook"`

---

## Task 3: CookMode component

- [ ] **Step 1: `src/components/cook-mode.tsx`**
```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { cookProgress } from "@/lib/cook-progress";
import { useWakeLock } from "@/lib/use-wake-lock";
import { PawMark } from "@/components/paw-mark";
import type { IngredientLineView } from "@/sanity/types";

export function CookMode({
  title,
  slug,
  steps,
  ingredients,
}: {
  title: string;
  slug: string;
  steps: string[];
  ingredients: IngredientLineView[];
}) {
  useWakeLock(true);
  const [index, setIndex] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const p = cookProgress(index, steps.length);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col">
      <div className="flex items-center justify-between">
        <Link href={`/recipe/${slug}`} className="kicker text-ink-soft hover:text-heather">
          Exit
        </Link>
        <span className="kicker text-ink-soft">{title}</span>
        <button
          type="button"
          onClick={() => setShowIngredients((s) => !s)}
          className="kicker text-ink-soft hover:text-heather"
          aria-expanded={showIngredients}
        >
          Ingredients
        </button>
      </div>

      {showIngredients ? (
        <ul className="mt-4 rounded-none border border-ink/15 bg-paper-sunk p-4 [font-variant-numeric:tabular-nums]">
          {ingredients.map((line) => (
            <li key={line._key} className="text-ink">
              <span className="text-ink-soft">
                {[line.quantity, line.unit].filter(Boolean).join(" ")}
              </span>{" "}
              {line.name ?? "—"}
            </li>
          ))}
        </ul>
      ) : null}

      {/* pawprint progress */}
      <div className="mt-8 flex items-center gap-2" aria-hidden>
        {steps.map((_, i) => (
          <PawMark
            key={i}
            className={`h-4 w-4 ${i <= p.current ? "text-clay" : "text-ink/20"}`}
          />
        ))}
      </div>

      <div className="mt-6 flex flex-1 flex-col justify-center">
        <p className="kicker text-heather">
          Step {p.total === 0 ? 0 : p.current + 1} of {p.total}
        </p>
        <p className="editorial-display mt-3 text-3xl leading-snug text-ink md:text-5xl">
          {steps[p.current] ?? "No steps yet."}
        </p>
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-heather/25 pt-4">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(i - 1, 0))}
          disabled={p.current === 0}
          className="kicker text-ink-soft hover:text-heather disabled:opacity-30"
        >
          ← Back
        </button>
        {p.isLast ? (
          <Link
            href={`/recipe/${slug}`}
            className="kicker border border-clay px-4 py-2 text-clay hover:bg-clay-wash"
          >
            Done
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(i + 1, steps.length - 1))}
            className="kicker border border-heather px-4 py-2 text-heather hover:bg-heather-wash"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Component test `src/components/cook-mode.test.tsx`**
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CookMode } from "@/components/cook-mode";

vi.mock("@/lib/use-wake-lock", () => ({ useWakeLock: () => {} }));

const steps = ["Chop the onion.", "Brown the beef.", "Simmer and serve."];

describe("CookMode", () => {
  it("starts on step 1 and advances with Next", async () => {
    const user = userEvent.setup();
    render(<CookMode title="Ragù" slug="ragu" steps={steps} ingredients={[]} />);
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    expect(screen.getByText("Chop the onion.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
    expect(screen.getByText("Brown the beef.")).toBeInTheDocument();
  });

  it("shows a Done link on the last step", async () => {
    const user = userEvent.setup();
    render(<CookMode title="Ragù" slug="ragu" steps={steps} ingredients={[]} />);
    await user.click(screen.getByRole("button", { name: /Next/ }));
    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("Step 3 of 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Done" })).toHaveAttribute("href", "/recipe/ragu");
  });

  it("toggles the ingredient peek", async () => {
    const user = userEvent.setup();
    render(
      <CookMode
        title="Ragù"
        slug="ragu"
        steps={steps}
        ingredients={[{ _key: "i1", name: "onion", quantity: "1", unit: "" }]}
      />,
    );
    expect(screen.queryByText("onion")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ingredients" }));
    expect(screen.getByText("onion")).toBeInTheDocument();
  });
});
```
- [ ] **Step 3:** Run — PASS (3). Commit: `git add src/components/cook-mode.tsx src/components/cook-mode.test.tsx && git commit -m "feat: CookMode step-through component"`

---

## Task 4: Cook page + link from recipe detail

- [ ] **Step 1: `src/app/(site)/recipe/[slug]/cook/page.tsx`**
```tsx
import { notFound } from "next/navigation";
import { client } from "@/sanity/lib/client";
import { RECIPE_QUERY } from "@/sanity/lib/queries";
import type { RecipeDetailData } from "@/sanity/types";
import { CookMode } from "@/components/cook-mode";

export default async function CookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const recipe = await client.fetch<RecipeDetailData | null>(RECIPE_QUERY, { slug });
  if (!recipe) notFound();

  return (
    <CookMode
      title={recipe.title}
      slug={recipe.slug}
      steps={recipe.steps ?? []}
      ingredients={recipe.ingredients ?? []}
    />
  );
}
```

- [ ] **Step 2: Add a "Cook mode" link on `src/app/(site)/recipe/[slug]/page.tsx`** — in the header block, next to the meta or below the title, add (visible to everyone):
```tsx
<div className="mt-3">
  <Link
    href={`/recipe/${recipe.slug}/cook`}
    className="kicker border border-heather px-3 py-1 text-heather hover:bg-heather-wash"
  >
    Cook mode
  </Link>
</div>
```
(If `Link` isn't already imported on this page from Phase 6, add `import Link from "next/link";`. Only show the link when `recipe.steps?.length` is truthy.)

- [ ] **Step 3: Verify** env-prefixed `npm run build` — route `/recipe/[slug]/cook` present. `npm test`, `npm run lint`, `npx tsc --noEmit`. Commit: `git add "src/app/(site)/recipe/[slug]/cook" "src/app/(site)/recipe/[slug]/page.tsx" && git commit -m "feat: cook mode page + link from recipe detail"`

---

## Task 5: Phase gate
- [ ] `npm test` (prior 51 + cook-progress 3 + cook-mode 3 = 57), `npm run lint` (0), `npx tsc --noEmit`, `npm audit` (0), env-prefixed `npm run build`. Report.

---

## Self-Review
**Spec coverage (Phase 7: big-text step-by-step, Wake Lock, pawprint progress):** step-through UI w/ large type (CookMode) ✓; Wake Lock w/ graceful degrade + re-acquire (useWakeLock) ✓; pawprint progress (PawMark row, clay/ink) ✓; reachable via "Cook mode" link ✓; ingredient peek (bonus, fits cooking) ✓.
**Design.md:** Fraunces step text, kicker controls, clay/heather, PawMark progress, paper bg, no emoji.
**Placeholders:** none (the full-width-paren note in Task 2 is a transcription caution, fixed on implement).
**Type consistency:** `IngredientLineView` reused from `types.ts`; `cookProgress` shape consistent across helper, test, and CookMode.
**Risks:** Wake Lock types are in `lib.dom` (TS5) — if missing, fall back to `any` + report. The hook is browser-only (`"use client"`); cook page is a server component rendering the client island. Cook mode lives inside the `(site)` layout (keeps the masthead for navigation) — acceptable; the view is still large and focused.
