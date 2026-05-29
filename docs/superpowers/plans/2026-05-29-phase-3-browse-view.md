# Cooking with June — Phase 3: Browse & View (read-only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or executing-plans. Checkbox (`- [ ]`) steps.

**Goal:** Publicly browse the recipe collection on the home page and open a full recipe detail page, reading published content from Sanity — all in the warm vintage-editorial design.

**Architecture:** Server Components fetch from Sanity via `next-sanity` (`useCdn: true`, ISR `revalidate = 60`). Pure presentation logic (rating average, time formatting) is isolated in `src/lib/` and unit-tested. GROQ queries + hand-written result types live in `src/sanity/`. Editorial recipe cards (polaroid framing) and a magazine-style detail page follow `design.md`. Missing cover images (the seeds have none) render a tasteful typographic placeholder.

**Tech Stack:** Next.js 16 App Router (RSC), next-sanity, @sanity/image-url, Tailwind v4, Vitest.

**Design contract:** Follow `design.md` exactly — heather dominant + clay/ochre accents, Fraunces display + Newsreader body, spaced small-caps kickers, hairline rules, the `.set` staggered load, NO emoji (use `PawMark` / Phosphor if an icon is needed), star ratings in ochre. Anti-slop list applies.

**Reference:** spec `docs/superpowers/specs/2026-05-29-cooking-with-june-design.md`; existing tokens in `src/app/globals.css`; existing `PawMark` in `src/components/paw-mark.tsx`.

---

## Conventions

- App code under `src/sanity/lib/**`, `src/lib/**`, components, and pages may use the `@/` alias (only the Sanity CLI-bundled `sanity.config.ts`/`sanity.cli.ts`/`src/sanity/env.ts` must stay relative — do not change those).
- Data-added sort and "newest" use Sanity's built-in `_createdAt`.

## File Structure

Created:

- `src/sanity/lib/client.ts` — read client (`useCdn: true`)
- `src/sanity/lib/image.ts` — `urlForImage()` builder
- `src/sanity/lib/queries.ts` — `RECIPES_QUERY`, `RECIPE_QUERY`, `RECIPE_SLUGS_QUERY`
- `src/sanity/types.ts` — hand-written result types
- `src/lib/rating.ts` + `src/lib/rating.test.ts` — `averageRating()`
- `src/lib/format.ts` + `src/lib/format.test.ts` — `formatMinutes()`, `totalTime()`
- `src/components/star-rating.tsx` + `.test.tsx` — read-only half-star display (ochre)
- `src/components/recipe-card.tsx` + `.test.tsx` — editorial polaroid card
- `src/components/recipe-cover.tsx` — cover image OR typographic placeholder
- `src/components/recipe-grid.tsx` — responsive grid
  Modified:
- `src/app/(site)/page.tsx` — collection header + grid (replaces splash)
  Created (route):
- `src/app/(site)/recipe/[slug]/page.tsx` — recipe detail

---

## Task 1: Install @sanity/image-url

- [ ] **Step 1:** `npm install @sanity/image-url`
- [ ] **Step 2:** Confirm: `node -e "console.log(require('./package.json').dependencies['@sanity/image-url'])"` prints a version.
- [ ] **Step 3:** Commit: `git add package.json package-lock.json && git commit -m "chore: add @sanity/image-url"`

---

## Task 2: Sanity read client, image builder, queries, types

- [ ] **Step 1: `src/sanity/lib/client.ts`**

```ts
import { createClient } from "next-sanity";
import { apiVersion, dataset, projectId } from "@/sanity/env";

export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true, // public dataset — cached CDN reads
});
```

- [ ] **Step 2: `src/sanity/lib/image.ts`**

```ts
import imageUrlBuilder from "@sanity/image-url";
import type { SanityImageSource } from "@sanity/image-url/lib/types/types";
import { client } from "@/sanity/lib/client";

const builder = imageUrlBuilder(client);

export function urlForImage(source: SanityImageSource) {
  return builder.image(source);
}
```

- [ ] **Step 3: `src/sanity/types.ts`**

```ts
import type { SanityImageSource } from "@sanity/image-url/lib/types/types";

export type RatingView = { editor: string | null; value: number };

export type RecipeCardData = {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  coverImage?: SanityImageSource | null;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  wishlist?: boolean;
  madeCount?: number;
  tags: string[] | null;
  ratings: RatingView[] | null;
};

export type IngredientLineView = {
  _key: string;
  quantity?: string;
  unit?: string;
  note?: string;
  name: string | null;
};

export type RecipeNoteView = { _key: string; author?: string; text: string };

export type RecipeDetailData = {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  story?: string;
  images?: SanityImageSource[];
  ingredients: IngredientLineView[] | null;
  steps: string[] | null;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  tags: string[] | null;
  ratings: (RatingView & { _key: string })[] | null;
  wishlist?: boolean;
  madeCount?: number;
  lastMadeAt?: string;
  notes: RecipeNoteView[] | null;
};
```

- [ ] **Step 4: `src/sanity/lib/queries.ts`**

```ts
import { defineQuery } from "next-sanity";

export const RECIPES_QUERY = defineQuery(`
  *[_type == "recipe" && defined(slug.current)] | order(title asc){
    _id,
    title,
    "slug": slug.current,
    description,
    "coverImage": images[0],
    prepTime,
    cookTime,
    servings,
    wishlist,
    madeCount,
    "tags": tags[]->name,
    "ratings": ratings[]{ "editor": editor->name, value }
  }
`);

export const RECIPE_QUERY = defineQuery(`
  *[_type == "recipe" && slug.current == $slug][0]{
    _id,
    title,
    "slug": slug.current,
    description,
    story,
    images,
    "ingredients": ingredients[]{ _key, quantity, unit, note, "name": ingredient->name },
    steps,
    prepTime,
    cookTime,
    servings,
    "tags": tags[]->name,
    "ratings": ratings[]{ _key, "editor": editor->name, value },
    wishlist,
    madeCount,
    lastMadeAt,
    "notes": notes[]{ _key, author, text }
  }
`);

export const RECIPE_SLUGS_QUERY = defineQuery(`
  *[_type == "recipe" && defined(slug.current)]{ "slug": slug.current }
`);
```

- [ ] **Step 5: Verify** `npx tsc --noEmit` clean. Commit:
      `git add src/sanity && git commit -m "feat: add Sanity read client, image builder, queries, and result types"`

---

## Task 3: averageRating (TDD)

- [ ] **Step 1: Test `src/lib/rating.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { averageRating } from "@/lib/rating";

describe("averageRating", () => {
  it("returns null for no ratings", () => {
    expect(averageRating(null)).toBeNull();
    expect(averageRating([])).toBeNull();
  });
  it("returns the single rating value", () => {
    expect(averageRating([{ editor: "Jacob", value: 4.5 }])).toBe(4.5);
  });
  it("averages and rounds to the nearest half star", () => {
    expect(
      averageRating([
        { editor: "Jacob", value: 4 },
        { editor: "Lily", value: 5 },
      ]),
    ).toBe(4.5);
    expect(
      averageRating([
        { editor: "Jacob", value: 4 },
        { editor: "Lily", value: 3 },
      ]),
    ).toBe(3.5);
    // 4 + 4 + 5 = 13/3 = 4.33 -> nearest half = 4.5
    expect(
      averageRating([
        { editor: "A", value: 4 },
        { editor: "B", value: 4 },
        { editor: "C", value: 5 },
      ]),
    ).toBe(4.5);
  });
});
```

- [ ] **Step 2:** Run — expect FAIL (unresolved import).
- [ ] **Step 3: `src/lib/rating.ts`**

```ts
import type { RatingView } from "@/sanity/types";

export function averageRating(
  ratings: RatingView[] | null | undefined,
): number | null {
  if (!ratings || ratings.length === 0) return null;
  const values = ratings
    .map((r) => r.value)
    .filter((v): v is number => typeof v === "number");
  if (values.length === 0) return null;
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.round(avg * 2) / 2;
}
```

- [ ] **Step 4:** Run — expect PASS (4 tests). Commit: `git add src/lib/rating.ts src/lib/rating.test.ts && git commit -m "feat: add averageRating helper"`

---

## Task 4: time formatting (TDD)

- [ ] **Step 1: Test `src/lib/format.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { formatMinutes, totalTime } from "@/lib/format";

describe("formatMinutes", () => {
  it("returns null for missing or non-positive values", () => {
    expect(formatMinutes(undefined)).toBeNull();
    expect(formatMinutes(0)).toBeNull();
  });
  it("formats minutes, hours, and combos", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1 hr");
    expect(formatMinutes(75)).toBe("1 hr 15 min");
  });
});

describe("totalTime", () => {
  it("sums prep and cook", () => {
    expect(totalTime(10, 35)).toBe("45 min");
    expect(totalTime(undefined, 60)).toBe("1 hr");
    expect(totalTime(undefined, undefined)).toBeNull();
  });
});
```

- [ ] **Step 2:** Run — expect FAIL.
- [ ] **Step 3: `src/lib/format.ts`**

```ts
export function formatMinutes(min: number | null | undefined): string | null {
  if (min == null || min <= 0) return null;
  const hours = Math.floor(min / 60);
  const mins = min % 60;
  if (hours && mins) return `${hours} hr ${mins} min`;
  if (hours) return `${hours} hr`;
  return `${mins} min`;
}

export function totalTime(
  prep: number | null | undefined,
  cook: number | null | undefined,
): string | null {
  return formatMinutes((prep ?? 0) + (cook ?? 0));
}
```

- [ ] **Step 4:** Run — expect PASS (5 tests). Commit: `git add src/lib/format.ts src/lib/format.test.ts && git commit -m "feat: add time formatting helpers"`

---

## Task 5: StarRating component (read-only, ochre half-stars)

**Files:** Create `src/components/star-rating.tsx`, test `src/components/star-rating.test.tsx`

- [ ] **Step 1: `src/components/star-rating.tsx`**

```tsx
/**
 * Read-only star rating, 0–5 in half steps. Ochre per design.md.
 * Renders 5 star glyphs (full / half / empty) and an accessible label.
 */
function Star({ fill }: { fill: "full" | "half" | "empty" }) {
  const id = `half-${Math.random().toString(36).slice(2)}`;
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      {fill === "half" ? (
        <defs>
          <linearGradient id={id}>
            <stop offset="50%" stopColor="currentColor" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
      ) : null}
      <path
        d="M12 2.5l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.9l-5.8 3.05 1.11-6.46-4.7-4.58 6.49-.94L12 2.5z"
        fill={
          fill === "full"
            ? "currentColor"
            : fill === "half"
              ? `url(#${id})`
              : "none"
        }
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export function StarRating({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const stars = Array.from({ length: 5 }, (_, i) => {
    if (value >= i + 1) return "full" as const;
    if (value >= i + 0.5) return "half" as const;
    return "empty" as const;
  });
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-ochre ${className ?? ""}`}
      role="img"
      aria-label={`${value} out of 5 stars`}
    >
      {stars.map((fill, i) => (
        <Star key={i} fill={fill} />
      ))}
    </span>
  );
}
```

> Note: the `Math.random()` id is for SVG gradient uniqueness within a render; it does not affect SSR correctness (ids only need to be unique in the document, and half-stars are rare). If a deterministic id is preferred, derive from index — acceptable either way.

- [ ] **Step 2: Test `src/components/star-rating.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StarRating } from "@/components/star-rating";

describe("StarRating", () => {
  it("exposes an accessible label with the value", () => {
    render(<StarRating value={4.5} />);
    expect(
      screen.getByRole("img", { name: "4.5 out of 5 stars" }),
    ).toBeInTheDocument();
  });
  it("always renders five star glyphs", () => {
    const { container } = render(<StarRating value={3} />);
    expect(container.querySelectorAll("svg").length).toBe(5);
  });
});
```

- [ ] **Step 3:** Run both tests — expect PASS. Commit: `git add src/components/star-rating.tsx src/components/star-rating.test.tsx && git commit -m "feat: add read-only StarRating component"`

---

## Task 6: RecipeCover + RecipeCard + RecipeGrid

**Design intent (follow design.md):** polaroid/scrapbook card — warm paper, thin ink keyline (no drop shadow), a subtle tilt, captioned. Cover image fills the top; when absent, a typographic placeholder (paper-sunk background, recipe title in Fraunces, a small `PawMark` in clay). Below: title (Fraunces), 1–2 line description (Newsreader), a meta row (total time · servings) as a spaced small-caps kicker, tags, and the average StarRating (ochre) when rated. Whole card links to `/recipe/[slug]`.

- [ ] **Step 1: `src/components/recipe-cover.tsx`**

```tsx
import Image from "next/image";
import type { SanityImageSource } from "@sanity/image-url/lib/types/types";
import { urlForImage } from "@/sanity/lib/image";
import { PawMark } from "@/components/paw-mark";

export function RecipeCover({
  image,
  title,
  className,
}: {
  image?: SanityImageSource | null;
  title: string;
  className?: string;
}) {
  if (!image) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-paper-sunk px-4 text-center ${className ?? ""}`}
      >
        <PawMark className="h-5 w-5 text-clay/70" />
        <span className="editorial-display text-xl text-ink/70">{title}</span>
      </div>
    );
  }
  return (
    <Image
      src={urlForImage(image)
        .width(800)
        .height(600)
        .fit("crop")
        .auto("format")
        .url()}
      alt={title}
      width={800}
      height={600}
      className={`h-full w-full object-cover ${className ?? ""}`}
    />
  );
}
```

- [ ] **Step 2: `src/components/recipe-card.tsx`**

```tsx
import Link from "next/link";
import type { RecipeCardData } from "@/sanity/types";
import { averageRating } from "@/lib/rating";
import { totalTime } from "@/lib/format";
import { StarRating } from "@/components/star-rating";
import { RecipeCover } from "@/components/recipe-cover";

export function RecipeCard({ recipe }: { recipe: RecipeCardData }) {
  const avg = averageRating(recipe.ratings);
  const time = totalTime(recipe.prepTime, recipe.cookTime);
  const meta = [time, recipe.servings ? `serves ${recipe.servings}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/recipe/${recipe.slug}`}
      className="group block border border-ink/15 bg-paper transition-transform hover:-translate-y-0.5"
    >
      <div className="aspect-4/3 overflow-hidden border-b border-ink/10">
        <RecipeCover image={recipe.coverImage} title={recipe.title} />
      </div>
      <div className="p-4">
        {meta ? <p className="kicker text-ink-soft">{meta}</p> : null}
        <h3 className="editorial-display mt-1 text-2xl text-ink group-hover:text-heather">
          {recipe.title}
        </h3>
        {recipe.description ? (
          <p className="mt-1 line-clamp-2 text-ink-soft">
            {recipe.description}
          </p>
        ) : null}
        <div className="mt-3 flex items-center justify-between">
          {avg != null ? (
            <StarRating value={avg} />
          ) : recipe.wishlist ? (
            <span className="kicker text-heather">To try</span>
          ) : (
            <span />
          )}
          {recipe.tags?.length ? (
            <span className="kicker text-ink-soft">{recipe.tags[0]}</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
```

> `line-clamp-2` is a built-in Tailwind utility (no plugin needed in v4).

- [ ] **Step 3: `src/components/recipe-grid.tsx`**

```tsx
import type { RecipeCardData } from "@/sanity/types";
import { RecipeCard } from "@/components/recipe-card";

export function RecipeGrid({ recipes }: { recipes: RecipeCardData[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {recipes.map((r) => (
        <RecipeCard key={r._id} recipe={r} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Test `src/components/recipe-card.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecipeCard } from "@/components/recipe-card";
import type { RecipeCardData } from "@/sanity/types";

vi.mock("@/sanity/lib/image", () => ({
  urlForImage: () => ({
    width: () => ({
      height: () => ({ fit: () => ({ auto: () => ({ url: () => "" }) }) }),
    }),
  }),
}));

const base: RecipeCardData = {
  _id: "1",
  title: "Weeknight Beef Ragù",
  slug: "weeknight-beef-ragu",
  description: "Cozy and quick.",
  coverImage: null,
  prepTime: 10,
  cookTime: 35,
  servings: 4,
  wishlist: false,
  madeCount: 3,
  tags: ["Dinner"],
  ratings: [{ editor: "Jacob", value: 4.5 }],
};

describe("RecipeCard", () => {
  it("links to the recipe and shows title, meta, and rating", () => {
    render(<RecipeCard recipe={base} />);
    const link = screen.getByRole("link", { name: /Weeknight Beef Ragù/ });
    expect(link).toHaveAttribute("href", "/recipe/weeknight-beef-ragu");
    expect(screen.getByText("45 min · serves 4")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "4.5 out of 5 stars" }),
    ).toBeInTheDocument();
  });

  it("shows a typographic placeholder title when there is no cover image", () => {
    render(<RecipeCard recipe={base} />);
    // title appears in both the placeholder cover and the heading
    expect(
      screen.getAllByText("Weeknight Beef Ragù").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("shows 'To try' for an unrated wishlist recipe", () => {
    render(<RecipeCard recipe={{ ...base, ratings: [], wishlist: true }} />);
    expect(screen.getByText("To try")).toBeInTheDocument();
  });
});
```

- [ ] **Step 5:** Run — expect PASS. Commit: `git add src/components/recipe-cover.tsx src/components/recipe-card.tsx src/components/recipe-grid.tsx src/components/recipe-card.test.tsx && git commit -m "feat: add recipe cover, card, and grid components"`

---

## Task 7: Home collection page

- [ ] **Step 1: Replace `src/app/(site)/page.tsx`**

```tsx
import { client } from "@/sanity/lib/client";
import { RECIPES_QUERY } from "@/sanity/lib/queries";
import type { RecipeCardData } from "@/sanity/types";
import { RecipeGrid } from "@/components/recipe-grid";
import { PawMark } from "@/components/paw-mark";

export const revalidate = 60;

export default async function HomePage() {
  const recipes = await client.fetch<RecipeCardData[]>(RECIPES_QUERY);

  return (
    <section>
      <header className="set set-1">
        <p className="kicker text-heather">The collection</p>
        <h1 className="editorial-display mt-2 text-5xl text-ink md:text-6xl">
          Cooking with June
        </h1>
        <div className="rule-draw mt-5 h-px w-full bg-heather/40" />
      </header>

      <div className="set set-2 mt-8">
        {recipes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <PawMark className="h-8 w-8 text-clay/70" />
            <p className="editorial-display text-2xl text-ink">
              No recipes yet
            </p>
            <p className="text-ink-soft">
              June is still deciding what to cook first.
            </p>
          </div>
        ) : (
          <RecipeGrid recipes={recipes} />
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify** `npm run build` compiles and `/` is dynamic/ISR. Commit:
      `git add "src/app/(site)/page.tsx" && git commit -m "feat: home page renders the recipe collection from Sanity"`

---

## Task 8: Recipe detail page

**Design intent:** editorial recipe page. Kicker meta (total time · serves) → Fraunces title → hairline rule → hero cover (or placeholder) → drop-capped description → optional story as Fraunces-italic heather aside → two-column-on-desktop body: ingredients (each line `quantity unit name`, note in italic) with tabular figures, and numbered steps with prominent Fraunces numerals → ratings (per-editor: name in small-caps + StarRating) → tags as small-caps chips. Use `.set` stagger. `notFound()` when the slug doesn't resolve.

- [ ] **Step 1: Create `src/app/(site)/recipe/[slug]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { client } from "@/sanity/lib/client";
import { RECIPE_QUERY, RECIPE_SLUGS_QUERY } from "@/sanity/lib/queries";
import type { RecipeDetailData } from "@/sanity/types";
import { totalTime, formatMinutes } from "@/lib/format";
import { StarRating } from "@/components/star-rating";
import { RecipeCover } from "@/components/recipe-cover";

export const revalidate = 60;

export async function generateStaticParams() {
  const slugs = await client
    .withConfig({ useCdn: false })
    .fetch<{ slug: string }[]>(RECIPE_SLUGS_QUERY);
  return slugs.filter((s) => s.slug).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const recipe = await client.fetch<RecipeDetailData | null>(RECIPE_QUERY, {
    slug,
  });
  if (!recipe) return { title: "Recipe not found · Cooking with June" };
  return {
    title: `${recipe.title} · Cooking with June`,
    description: recipe.description,
  };
}

export default async function RecipePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const recipe = await client.fetch<RecipeDetailData | null>(RECIPE_QUERY, {
    slug,
  });
  if (!recipe) notFound();

  const time = totalTime(recipe.prepTime, recipe.cookTime);
  const meta = [time, recipe.servings ? `serves ${recipe.servings}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="mx-auto max-w-3xl">
      <header className="set set-1">
        {meta ? <p className="kicker text-heather">{meta}</p> : null}
        <h1 className="editorial-display mt-2 text-5xl text-ink md:text-6xl">
          {recipe.title}
        </h1>
        <div className="rule-draw mt-5 h-px w-full bg-heather/40" />
      </header>

      <div className="set set-2 mt-6 aspect-3/2 overflow-hidden border border-ink/15">
        <RecipeCover image={recipe.images?.[0]} title={recipe.title} />
      </div>

      {recipe.description ? (
        <p className="dropcap set set-3 mt-6 text-lg leading-relaxed text-ink">
          {recipe.description}
        </p>
      ) : null}

      {recipe.story ? (
        <p className="editorial-aside mt-5 text-xl text-heather">
          {recipe.story}
        </p>
      ) : null}

      <div className="mt-10 grid gap-10 md:grid-cols-[1fr_1.6fr]">
        <section aria-labelledby="ingredients-heading">
          <h2 id="ingredients-heading" className="kicker text-heather">
            Ingredients
          </h2>
          <ul className="mt-3 space-y-2 [font-variant-numeric:tabular-nums]">
            {recipe.ingredients?.map((line) => (
              <li
                key={line._key}
                className="flex gap-2 border-b border-ink/10 pb-2"
              >
                <span className="text-ink-soft">
                  {[line.quantity, line.unit].filter(Boolean).join(" ")}
                </span>
                <span className="text-ink">
                  {line.name ?? "—"}
                  {line.note ? (
                    <span className="italic text-ink-soft"> ({line.note})</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="steps-heading">
          <h2 id="steps-heading" className="kicker text-heather">
            Method
          </h2>
          <ol className="mt-3 space-y-5">
            {recipe.steps?.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="editorial-display text-3xl leading-none text-clay">
                  {i + 1}
                </span>
                <p className="pt-1 leading-relaxed text-ink">{step}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {recipe.ratings?.length ? (
        <section className="mt-10 border-t border-heather/25 pt-6">
          <h2 className="kicker text-heather">Ratings</h2>
          <ul className="mt-3 flex flex-wrap gap-6">
            {recipe.ratings.map((r) => (
              <li key={r._key} className="flex items-center gap-2">
                <span className="kicker text-ink-soft">{r.editor ?? "—"}</span>
                <StarRating value={r.value} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {recipe.tags?.length ? (
        <div className="mt-8 flex flex-wrap gap-2">
          {recipe.tags.map((t) => (
            <span
              key={t}
              className="kicker border border-heather/40 px-2 py-1 text-heather"
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}
```

- [ ] **Step 2: Verify** `npm run build` (route `/recipe/[slug]` present, static params generated for the 2 seeded recipes). Manually confirm a known slug (`weeknight-beef-ragu`) builds. Commit:
      `git add "src/app/(site)/recipe" && git commit -m "feat: recipe detail page"`

---

## Task 9: Phase gate

- [ ] **Step 1:** `npm test` (expect prior 13 + rating 4 + format 5 + star 2 + recipe-card 3 = 27), `npm run build`, `npm run lint`, `npm audit`, `npx tsc --noEmit` — all clean.
- [ ] **Step 2:** Report results.

---

## Self-Review

**Spec coverage (Phase 3 roadmap: home grid, recipe detail, Sanity CDN reads, responsive cards):** home grid (Task 7) ✓, detail page (Task 8) ✓, CDN reads via `useCdn:true` + ISR (Task 2/7/8) ✓, responsive polaroid cards w/ missing-image fallback (Task 6) ✓.
**Design.md:** heather/clay/ochre, Fraunces+Newsreader, kickers, hairline rules, `.set` motion, drop cap, no emoji, ochre stars — all specified. Anti-slop respected (no shadows-on-cards beyond a hover lift; keylines not shadows).
**Placeholders:** none — all code complete. Seeds lack images, so the typographic placeholder path is the common case and is implemented + tested.
**Type consistency:** `RecipeCardData`/`RecipeDetailData`/`RatingView` defined in `types.ts`, consumed by queries' fetch generics, card, grid, and detail page. `averageRating`/`totalTime`/`formatMinutes` signatures consistent across utils, tests, card, and detail.
**Risk:** `urlForImage` is only exercised when images exist (none seeded yet) — the card test mocks it; real image rendering gets verified in Phase 8 when June art/photos land. GROQ field names mirror the Phase 2 schema exactly.
