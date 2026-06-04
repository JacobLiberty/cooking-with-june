# Chunk 1 — Quick Wins + PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps; TDD where marked.

**Goal:** Add the June-approved seal, a share-link button, recipe notes (display + editor add), and make the app an installable PWA.

**Spec:** `docs/superpowers/specs/2026-06-04-enhancements-and-the-plan.md` (sections A–D).

**Conventions:** App code uses `@/`. Don't touch `src/sanity/env.ts`, `sanity.config.ts`, `sanity.cli.ts`, `.env*`. Design per `design.md` (terracotta/clay, Caslon/Newsreader, kicker, no emoji — `PawMark` is fine). Builds need `NEXT_PUBLIC_SANITY_PROJECT_ID=zwjctldy NEXT_PUBLIC_SANITY_DATASET=production npm run build`. PWA icons already exist at `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable.png`.

---

## Task 1: isJuneApproved (TDD)

- [ ] **Step 1: Test `src/lib/june-approved.test.ts`**
```ts
import { describe, it, expect } from "vitest";
import { isJuneApproved } from "@/lib/june-approved";

describe("isJuneApproved", () => {
  it("requires at least two ratings, all >= 4.5", () => {
    expect(isJuneApproved(null)).toBe(false);
    expect(isJuneApproved([])).toBe(false);
    expect(isJuneApproved([{ editor: "Jacob", value: 5 }])).toBe(false); // only one
    expect(
      isJuneApproved([
        { editor: "Jacob", value: 5 },
        { editor: "Lily", value: 4.5 },
      ]),
    ).toBe(true);
    expect(
      isJuneApproved([
        { editor: "Jacob", value: 5 },
        { editor: "Lily", value: 4 },
      ]),
    ).toBe(false); // one below 4.5
  });
});
```
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3: `src/lib/june-approved.ts`**
```ts
import type { RatingView } from "@/sanity/types";

export function isJuneApproved(
  ratings: RatingView[] | null | undefined,
): boolean {
  if (!ratings || ratings.length < 2) return false;
  return ratings.every((r) => typeof r.value === "number" && r.value >= 4.5);
}
```
- [ ] **Step 4:** Run — PASS. Commit: `git add src/lib/june-approved.ts src/lib/june-approved.test.ts && git commit -m "feat: isJuneApproved helper"`

---

## Task 2: JuneApprovedBadge + wire into card & detail

- [ ] **Step 1: `src/components/june-approved-badge.tsx`**
```tsx
import { PawMark } from "@/components/paw-mark";

export function JuneApprovedBadge({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className ?? ""}`}
      title="June approved — you both rated this 4.5★ or higher"
    >
      <PawMark className="h-3.5 w-3.5 text-clay" />
      <span className="kicker text-terracotta">June approved</span>
    </span>
  );
}
```

- [ ] **Step 2: RecipeCard** (`src/components/recipe-card.tsx`) — import `isJuneApproved` and `JuneApprovedBadge`; compute `const approved = isJuneApproved(recipe.ratings);` and render the badge in the card body (e.g., just above the title): `{approved ? <JuneApprovedBadge className="mb-1" /> : null}`.

- [ ] **Step 3: Recipe detail** (`src/app/(site)/recipe/[slug]/page.tsx`) — import both; in the header block, right after the `{meta ? ... : null}` line, add `{isJuneApproved(recipe.ratings) ? <JuneApprovedBadge className="mt-1" /> : null}`.

- [ ] **Step 4: Test `src/components/recipe-card.test.tsx`** — add a case: a recipe with two ≥4.5 ratings shows "June approved"; a recipe with one rating does not. (Append to the existing describe; reuse the `base` fixture, overriding `ratings`.)

- [ ] **Step 5:** Run tests; env-build. Commit: `git add src/components/june-approved-badge.tsx src/components/recipe-card.tsx "src/app/(site)/recipe/[slug]/page.tsx" src/components/recipe-card.test.tsx && git commit -m "feat: June-approved seal on cards + recipe detail"`

---

## Task 3: Share button

- [ ] **Step 1: `src/components/share-button.tsx`**
```tsx
"use client";

import { useState } from "react";

export function ShareButton({ className }: { className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — ignore
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`kicker text-terracotta transition-colors hover:text-terracotta-deep ${className ?? ""}`}
    >
      {copied ? "Link copied!" : "Share"}
    </button>
  );
}
```

- [ ] **Step 2: Recipe detail** — import `ShareButton`; place it alongside the existing "Cook mode" / "Edit recipe" links in the header (in the same row/area). Example: wrap the cook-mode link and `<ShareButton />` in a `flex flex-wrap items-center gap-4` container.

- [ ] **Step 3:** env-build. Commit: `git add src/components/share-button.tsx "src/app/(site)/recipe/[slug]/page.tsx" && git commit -m "feat: copy-share-link button on recipe detail"`

---

## Task 4: Recipe notes (display + editor add)

- [ ] **Step 1: `addNote` server action** — append to `src/app/actions/recipe-actions.ts`:
```ts
export async function addNote(
  recipeId: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const { name } = await requireEditor();
  const clean = text.trim();
  if (!clean) return { ok: false, error: "Note is empty" };
  if (clean.length > 500) return { ok: false, error: "Note too long (max 500)" };
  await assertRecipe(recipeId);
  const write = getWriteClient();
  await write
    .patch(recipeId)
    .setIfMissing({ notes: [] })
    .append("notes", [
      {
        _key: crypto.randomUUID(),
        _type: "recipeNote",
        author: name ?? undefined,
        text: clean,
      },
    ])
    .commit();
  revalidatePath("/", "layout");
  return { ok: true };
}
```

- [ ] **Step 2: `src/components/add-note-form.tsx`**
```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addNote } from "@/app/actions/recipe-actions";

export function AddNoteForm({ recipeId }: { recipeId: string }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    start(async () => {
      const res = await addNote(recipeId, t);
      if (res.ok) {
        setText("");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="mt-3 flex items-center gap-3">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        placeholder="Add a note…"
        className="flex-1 border-b border-ink/25 bg-transparent pb-1 text-ink placeholder:text-ink-soft/60 focus:border-terracotta"
      />
      <button
        type="submit"
        disabled={pending}
        className="kicker text-terracotta hover:text-terracotta-deep disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Recipe detail** — render a "From our kitchen" notes section (notes already projected by `RECIPE_QUERY` into `recipe.notes`). Add after the ratings/tags area (and before the editor divider/EditorActions). Show the section when there are notes OR the viewer is an editor:
```tsx
{recipe.notes?.length || viewer.isEditor ? (
  <section className="mt-10 border-t border-terracotta/25 pt-6">
    <h2 className="kicker text-terracotta">From our kitchen</h2>
    {recipe.notes?.length ? (
      <ul className="mt-3 space-y-2">
        {recipe.notes.map((n) => (
          <li key={n._key} className="text-ink">
            {n.author ? (
              <span className="kicker mr-2 text-ink-soft">{n.author}</span>
            ) : null}
            <span className="italic">{n.text}</span>
          </li>
        ))}
      </ul>
    ) : null}
    {viewer.isEditor ? <AddNoteForm recipeId={recipe._id} /> : null}
  </section>
) : null}
```
Import `AddNoteForm`. (`viewer` is already fetched on this page.)

- [ ] **Step 4:** `npx tsc --noEmit`, env-build. Commit: `git add src/app/actions/recipe-actions.ts src/components/add-note-form.tsx "src/app/(site)/recipe/[slug]/page.tsx" && git commit -m "feat: recipe notes — display + editor add"`

---

## Task 5: PWA (installable)

- [ ] **Step 1: `src/app/manifest.ts`**
```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cooking with June",
    short_name: "June",
    description: "A warm, editorial home cookbook by Jacob & Lily.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf4ea",
    theme_color: "#55622f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
```

- [ ] **Step 2: Root layout** (`src/app/layout.tsx`) — add a `viewport` export with the theme color and `appleWebApp` metadata. Add to the file:
```ts
import type { Metadata, Viewport } from "next";
// ...
export const viewport: Viewport = {
  themeColor: "#55622f",
};
```
and extend the existing `metadata` with:
```ts
  appleWebApp: { capable: true, title: "Cooking with June", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
```
(Keep the existing `title`/`description`. Don't remove the `icon.png` favicon route — these are additive.)

- [ ] **Step 3:** env-build — confirm `/manifest.webmanifest` is generated and the build compiles. Commit: `git add src/app/manifest.ts src/app/layout.tsx && git commit -m "feat: installable PWA (manifest, theme color, apple web app, June icons)"`

---

## Task 6: Phase gate
- [ ] `npm test` (prior 63 + june-approved 1 + recipe-card seal case ~2 ≈ 66), `npm run lint` (0), `npx tsc --noEmit`, `npm audit` (0), env-build (routes compile; `/manifest.webmanifest` present). Report.

---

## Self-Review
**Spec coverage:** seal (A) ✓ pure + badge + card/detail; share (B) ✓; notes (C) ✓ display + editor add via gated action; PWA (D) ✓ manifest + meta + icons, no offline. **Security:** `addNote` gated by `requireEditor()` + `assertRecipe()`, text validated/capped, write token server-only. **Design:** terracotta/clay, kicker, PawMark, no emoji. **Types:** `isJuneApproved(RatingView[])` matches `recipe.ratings`; `addNote` returns `{ok,error}`. **Risk:** `crypto.randomUUID()` is available in the Node/server-action runtime (Next 16). `navigator.clipboard` needs HTTPS/localhost — degrades silently otherwise.
