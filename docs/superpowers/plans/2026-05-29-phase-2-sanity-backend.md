# Cooking with June — Phase 2: Sanity Backend & Schemas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define the Sanity content model (recipe, ingredient, tag, editor) as code, embed Sanity Studio at `/studio` in the Next.js app, and seed sample content — so editors have a working CMS and later phases have real data to read.

**Architecture:** Embedded-Studio pattern (recommended for Next.js): `sanity.config.ts` at the repo root, schema types under `src/sanity/schemaTypes/`, Studio mounted at `src/app/studio/[[...tool]]/page.tsx`. The cookbook's header/footer chrome moves into a `(site)` route group so `/studio` renders full-screen without it. Schema is authored with `defineType`/`defineField`/`defineArrayMember`; reusable content (ingredients, tags, editors) are reference documents, per-line/per-rating data are embedded objects. Sample content is seeded via the authenticated Sanity MCP (controller-run), not the CLI.

**Tech Stack:** Sanity v3 (`sanity`, `next-sanity`, `@sanity/vision`, `@sanity/icons`), `styled-components` (Studio peer dep), Next.js 16 App Router, Vitest.

**Reference spec:** `docs/superpowers/specs/2026-05-29-cooking-with-june-design.md` (Data Model + Authorization sections).

**Sanity project (already created):** `projectId=zwjctldy`, `dataset=production` (public ACL), CORS allows `http://localhost:3000`.

---

## PRECONDITION (must hold before any `npm run build`/`npm run dev` step)

`/Users/jacobliberty/Documents/GitHub/cooking-with-june/.env.local` must exist with:
```
NEXT_PUBLIC_SANITY_PROJECT_ID=zwjctldy
NEXT_PUBLIC_SANITY_DATASET=production
```
The app's `src/sanity/env.ts` throws at import if these are missing, so the build will fail without them. (The file is git-ignored and created by the user, since the harness denies writing `.env.*`.) Do not attempt to create `.env.local` from an agent.

---

## Conventions for this phase

- **Imports inside `src/sanity/**` and the root `sanity.config.ts`/`sanity.cli.ts` use RELATIVE paths, not the `@/` alias.** The Sanity CLI bundler does not resolve the Next.js `@/*` tsconfig alias; relative imports work everywhere. App code (components, tests) may keep using `@/`.
- `apiVersion` is `"2026-02-01"`.
- `createdAt` from the spec maps to Sanity's built-in `_createdAt` (every document has it) — we do NOT add a custom `createdAt` field. Date-added sorting (Phase 4) uses `_createdAt`.

---

## File Structure

Created:
- `src/sanity/lib/assert.ts` — `assertValue()` helper (throws on undefined env)
- `src/sanity/lib/assert.test.ts` — unit tests for `assertValue`
- `src/sanity/env.ts` — `projectId` / `dataset` / `apiVersion` from env, validated
- `src/sanity/schemaTypes/objects/ingredient-line.ts` — `ingredientLine` object (qty/unit/ingredient ref/note)
- `src/sanity/schemaTypes/objects/rating.ts` — `rating` object (editor ref + 0–5 half-step value)
- `src/sanity/schemaTypes/objects/recipe-note.ts` — `recipeNote` object (author + text)
- `src/sanity/schemaTypes/documents/ingredient.ts` — `ingredient` document
- `src/sanity/schemaTypes/documents/tag.ts` — `tag` document
- `src/sanity/schemaTypes/documents/editor.ts` — `editor` document (authorization allowlist)
- `src/sanity/schemaTypes/documents/recipe.ts` — `recipe` document
- `src/sanity/schemaTypes/index.ts` — `schemaTypes` array
- `src/sanity/schemaTypes/schema.test.ts` — content-model guard test
- `sanity.config.ts` — Studio config (root)
- `sanity.cli.ts` — CLI config (root)
- `src/app/studio/[[...tool]]/page.tsx` — embedded Studio route
- `src/app/(site)/layout.tsx` — site chrome (header/main/footer)

Modified / moved:
- `src/app/layout.tsx` — slimmed to html/body + fonts only (chrome moves to `(site)`)
- `src/app/page.tsx` → moved to `src/app/(site)/page.tsx` (content unchanged)
- `src/app/about/page.tsx` → moved to `src/app/(site)/about/page.tsx` (content unchanged)
- `package.json` — new dependencies

---

## Task 1: Install Sanity dependencies

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Install**

```bash
npm install sanity next-sanity @sanity/vision @sanity/icons styled-components
```
Expected: installs. React 19 is new — if any peer-dependency warnings appear (esp. from `styled-components` or `sanity`), capture the exact text and report it; do NOT pass `--force`/`--legacy-peer-deps` unless install hard-fails, and if you must, report exactly what you ran.

- [ ] **Step 2: Sanity check the versions installed**

```bash
node -e "const p=require('./package.json'); for (const k of ['sanity','next-sanity','@sanity/vision','@sanity/icons','styled-components']) console.log(k, p.dependencies[k]);"
```
Expected: each prints a version (sanity v3.x, next-sanity v9/v10/v11.x).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add Sanity Studio and client dependencies"
```

---

## Task 2: Env config and assert helper (TDD)

**Files:** Test `src/sanity/lib/assert.test.ts`; Create `src/sanity/lib/assert.ts`, `src/sanity/env.ts`

- [ ] **Step 1: Write the failing test** — `src/sanity/lib/assert.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { assertValue } from "@/sanity/lib/assert";

describe("assertValue", () => {
  it("returns the value when it is defined", () => {
    expect(assertValue("production", "missing")).toBe("production");
    expect(assertValue(0, "missing")).toBe(0);
    expect(assertValue("", "missing")).toBe("");
  });

  it("throws the given message when the value is undefined", () => {
    expect(() => assertValue(undefined, "Missing NEXT_PUBLIC_SANITY_DATASET")).toThrowError(
      "Missing NEXT_PUBLIC_SANITY_DATASET",
    );
  });
});
```

- [ ] **Step 2: Run it to verify it FAILS**

```bash
npx vitest run src/sanity/lib/assert.test.ts
```
Expected: FAIL — cannot resolve `@/sanity/lib/assert`.

- [ ] **Step 3: Implement** — `src/sanity/lib/assert.ts`

```ts
export function assertValue<T>(value: T | undefined, errorMessage: string): T {
  if (value === undefined) {
    throw new Error(errorMessage);
  }
  return value;
}
```

- [ ] **Step 4: Run it to verify it PASSES**

```bash
npx vitest run src/sanity/lib/assert.test.ts
```
Expected: PASS — 2 tests.

- [ ] **Step 5: Create `src/sanity/env.ts`**

```ts
import { assertValue } from "./lib/assert";

export const apiVersion =
  process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2026-02-01";

export const dataset = assertValue(
  process.env.NEXT_PUBLIC_SANITY_DATASET,
  "Missing environment variable: NEXT_PUBLIC_SANITY_DATASET",
);

export const projectId = assertValue(
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  "Missing environment variable: NEXT_PUBLIC_SANITY_PROJECT_ID",
);
```

- [ ] **Step 6: Commit**

```bash
git add src/sanity/lib/assert.ts src/sanity/lib/assert.test.ts src/sanity/env.ts
git commit -m "feat: add Sanity env config and assertValue helper"
```

---

## Task 3: Schema types

Create the object types first (referenced by `recipe`), then the documents, then the index and a guard test. Use RELATIVE imports.

**Files:** the seven schema files + `index.ts` + `schema.test.ts` listed in File Structure.

- [ ] **Step 1: `src/sanity/schemaTypes/objects/ingredient-line.ts`**

```ts
import { defineType, defineField } from "sanity";

export const ingredientLine = defineType({
  name: "ingredientLine",
  title: "Ingredient",
  type: "object",
  fields: [
    defineField({
      name: "ingredient",
      title: "Ingredient",
      type: "reference",
      to: [{ type: "ingredient" }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "quantity",
      title: "Quantity",
      type: "string",
      description: 'e.g. "1", "1/2", "2-3"',
    }),
    defineField({
      name: "unit",
      title: "Unit",
      type: "string",
      description: 'e.g. "lb", "cup", "tbsp"',
    }),
    defineField({
      name: "note",
      title: "Note",
      type: "string",
      description: 'e.g. "finely chopped"',
    }),
  ],
  preview: {
    select: { quantity: "quantity", unit: "unit", note: "note" },
    prepare({ quantity, unit, note }) {
      const left = [quantity, unit].filter(Boolean).join(" ");
      return { title: left || "Ingredient", subtitle: note };
    },
  },
});
```

- [ ] **Step 2: `src/sanity/schemaTypes/objects/rating.ts`**

```ts
import { defineType, defineField } from "sanity";

export const rating = defineType({
  name: "rating",
  title: "Rating",
  type: "object",
  fields: [
    defineField({
      name: "editor",
      title: "Editor",
      type: "reference",
      to: [{ type: "editor" }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "value",
      title: "Stars",
      type: "number",
      description: "0 to 5, in half-star steps",
      validation: (rule) =>
        rule
          .required()
          .min(0)
          .max(5)
          .precision(1)
          .custom((v) =>
            v === undefined || (v * 2) % 1 === 0
              ? true
              : "Use half-star steps (e.g. 3.5)",
          ),
    }),
  ],
  preview: {
    select: { value: "value" },
    prepare({ value }) {
      return { title: `${value ?? "?"} ★` };
    },
  },
});
```

- [ ] **Step 3: `src/sanity/schemaTypes/objects/recipe-note.ts`**

```ts
import { defineType, defineField } from "sanity";

export const recipeNote = defineType({
  name: "recipeNote",
  title: "Note",
  type: "object",
  fields: [
    defineField({
      name: "author",
      title: "Author",
      type: "string",
      description: 'e.g. "Lily"',
    }),
    defineField({
      name: "text",
      title: "Note",
      type: "text",
      rows: 2,
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: { text: "text", author: "author" },
    prepare({ text, author }) {
      return { title: text, subtitle: author };
    },
  },
});
```

- [ ] **Step 4: `src/sanity/schemaTypes/documents/ingredient.ts`**

```ts
import { defineType, defineField } from "sanity";
import { TagIcon } from "@sanity/icons";

export const ingredient = defineType({
  name: "ingredient",
  title: "Ingredient",
  type: "document",
  icon: TagIcon,
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      description: 'Canonical ingredient name, e.g. "ground beef"',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "category",
      title: "Category",
      type: "string",
      options: {
        list: [
          { title: "Produce", value: "produce" },
          { title: "Protein", value: "protein" },
          { title: "Dairy", value: "dairy" },
          { title: "Pantry", value: "pantry" },
          { title: "Spice", value: "spice" },
          { title: "Other", value: "other" },
        ],
      },
    }),
  ],
  preview: { select: { title: "name", subtitle: "category" } },
});
```

- [ ] **Step 5: `src/sanity/schemaTypes/documents/tag.ts`**

```ts
import { defineType, defineField } from "sanity";
import { TagIcon } from "@sanity/icons";

export const tag = defineType({
  name: "tag",
  title: "Tag",
  type: "document",
  icon: TagIcon,
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "name" },
      validation: (rule) => rule.required(),
    }),
  ],
  preview: { select: { title: "name" } },
});
```

- [ ] **Step 6: `src/sanity/schemaTypes/documents/editor.ts`**

```ts
import { defineType, defineField } from "sanity";
import { UserIcon } from "@sanity/icons";

export const editor = defineType({
  name: "editor",
  title: "Editor",
  type: "document",
  icon: UserIcon,
  description:
    "A person allowed to edit recipes and leave ratings. Email must match their Google sign-in.",
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "email",
      title: "Email",
      type: "string",
      description: "Google account email used to sign in",
      validation: (rule) => rule.required().email(),
    }),
  ],
  preview: { select: { title: "name", subtitle: "email" } },
});
```

- [ ] **Step 7: `src/sanity/schemaTypes/documents/recipe.ts`**

```ts
import { defineType, defineField, defineArrayMember } from "sanity";
import { DocumentTextIcon } from "@sanity/icons";

export const recipe = defineType({
  name: "recipe",
  title: "Recipe",
  type: "document",
  icon: DocumentTextIcon,
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title" },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "text",
      rows: 3,
      description: "Short blurb shown on cards and the top of the recipe",
    }),
    defineField({
      name: "story",
      title: "Story",
      type: "text",
      rows: 4,
      description: 'Optional "from our kitchen" story',
    }),
    defineField({
      name: "images",
      title: "Photos",
      type: "array",
      of: [defineArrayMember({ type: "image", options: { hotspot: true } })],
      validation: (rule) => rule.required().min(1).error("Add at least one photo"),
    }),
    defineField({
      name: "ingredients",
      title: "Ingredients",
      type: "array",
      of: [defineArrayMember({ type: "ingredientLine" })],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "steps",
      title: "Steps",
      type: "array",
      of: [defineArrayMember({ type: "text", rows: 2 })],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "prepTime",
      title: "Prep time (minutes)",
      type: "number",
      validation: (rule) => rule.min(0),
    }),
    defineField({
      name: "cookTime",
      title: "Cook time (minutes)",
      type: "number",
      validation: (rule) => rule.min(0),
    }),
    defineField({
      name: "servings",
      title: "Servings",
      type: "number",
      validation: (rule) => rule.min(1),
    }),
    defineField({
      name: "tags",
      title: "Tags",
      type: "array",
      of: [defineArrayMember({ type: "reference", to: [{ type: "tag" }] })],
    }),
    defineField({
      name: "ratings",
      title: "Ratings",
      type: "array",
      of: [defineArrayMember({ type: "rating" })],
    }),
    defineField({
      name: "wishlist",
      title: "To-try (wishlist)",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "madeCount",
      title: "Times made",
      type: "number",
      initialValue: 0,
      validation: (rule) => rule.min(0),
    }),
    defineField({
      name: "lastMadeAt",
      title: "Last made",
      type: "datetime",
    }),
    defineField({
      name: "notes",
      title: "Notes",
      type: "array",
      of: [defineArrayMember({ type: "recipeNote" })],
    }),
  ],
  preview: {
    select: { title: "title", media: "images.0" },
  },
});
```

- [ ] **Step 8: `src/sanity/schemaTypes/index.ts`**

```ts
import { recipe } from "./documents/recipe";
import { ingredient } from "./documents/ingredient";
import { tag } from "./documents/tag";
import { editor } from "./documents/editor";
import { ingredientLine } from "./objects/ingredient-line";
import { rating } from "./objects/rating";
import { recipeNote } from "./objects/recipe-note";

export const schemaTypes = [
  // documents
  recipe,
  ingredient,
  tag,
  editor,
  // objects
  ingredientLine,
  rating,
  recipeNote,
];
```

- [ ] **Step 9: Write the content-model guard test** — `src/sanity/schemaTypes/schema.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { schemaTypes } from "@/sanity/schemaTypes";
import { recipe } from "@/sanity/schemaTypes/documents/recipe";

function fieldByName(type: typeof recipe, name: string) {
  return type.fields.find((f) => f.name === name);
}

describe("schema content model", () => {
  it("registers all four document types and three object types", () => {
    const names = schemaTypes.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "recipe",
        "ingredient",
        "tag",
        "editor",
        "ingredientLine",
        "rating",
        "recipeNote",
      ]),
    );
  });

  it("recipe has the core fields from the spec", () => {
    const names = recipe.fields.map((f) => f.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "title",
        "slug",
        "description",
        "images",
        "ingredients",
        "steps",
        "tags",
        "ratings",
        "wishlist",
        "madeCount",
        "lastMadeAt",
        "notes",
      ]),
    );
  });

  it("recipe.ingredients is a list of ingredientLine objects", () => {
    const ingredients = fieldByName(recipe, "ingredients");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((ingredients as any).of[0].type).toBe("ingredientLine");
  });

  it("recipe.tags references the tag document", () => {
    const tags = fieldByName(recipe, "tags");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const member = (tags as any).of[0];
    expect(member.type).toBe("reference");
    expect(member.to[0].type).toBe("tag");
  });

  it("recipe.ratings is a list of rating objects", () => {
    const ratings = fieldByName(recipe, "ratings");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((ratings as any).of[0].type).toBe("rating");
  });
});
```

- [ ] **Step 10: Run the schema test**

```bash
npx vitest run src/sanity/schemaTypes/schema.test.ts
```
Expected: PASS — 5 tests. If importing `sanity` or `@sanity/icons` errors inside Vitest (jsdom), STOP and report the exact error — do not delete the test silently; we will adjust the test environment instead.

- [ ] **Step 11: Commit**

```bash
git add src/sanity/schemaTypes
git commit -m "feat: add recipe, ingredient, tag, and editor schemas"
```

---

## Task 4: Studio and CLI config

**Files:** Create `sanity.config.ts`, `sanity.cli.ts` (repo root)

- [ ] **Step 1: `sanity.config.ts`**

```ts
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { apiVersion, dataset, projectId } from "./src/sanity/env";
import { schemaTypes } from "./src/sanity/schemaTypes";

export default defineConfig({
  name: "default",
  title: "Cooking with June",
  projectId,
  dataset,
  basePath: "/studio",
  schema: { types: schemaTypes },
  plugins: [structureTool(), visionTool({ defaultApiVersion: apiVersion })],
});
```

- [ ] **Step 2: `sanity.cli.ts`** (projectId/dataset are public, safe to hardcode)

```ts
import { defineCliConfig } from "sanity/cli";

export default defineCliConfig({
  api: {
    projectId: "zwjctldy",
    dataset: "production",
  },
});
```

- [ ] **Step 3: Type-check the config compiles**

```bash
npx tsc --noEmit
```
Expected: no errors. (This confirms the config + schema + env imports type-check together.)

- [ ] **Step 4: Commit**

```bash
git add sanity.config.ts sanity.cli.ts
git commit -m "feat: add Sanity Studio and CLI configuration"
```

---

## Task 5: Embedded Studio route + `(site)` layout restructure

Move the cookbook chrome into a `(site)` route group so `/studio` renders without the header/footer, then mount the Studio. End with a green build.

**Files:**
- Create: `src/app/(site)/layout.tsx`, `src/app/studio/[[...tool]]/page.tsx`
- Move: `src/app/page.tsx` → `src/app/(site)/page.tsx`; `src/app/about/page.tsx` → `src/app/(site)/about/page.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Move the two pages into the `(site)` group**

```bash
mkdir -p "src/app/(site)/about"
git mv src/app/page.tsx "src/app/(site)/page.tsx"
git mv src/app/about/page.tsx "src/app/(site)/about/page.tsx"
rmdir src/app/about
```
(Their contents stay exactly as-is.)

- [ ] **Step 2: Create `src/app/(site)/layout.tsx`** (the chrome)

```tsx
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 3: Slim `src/app/layout.tsx`** to just html/body + fonts (remove header/footer/main; those now live in the `(site)` layout)

```tsx
import type { Metadata } from "next";
import { Fraunces, Caveat } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cooking with June",
  description:
    "A pastel, homemade cookbook for Jacob & Lily — and June the cat.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${caveat.variable}`}>
      <body className="min-h-screen bg-cream font-serif text-cocoa antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Create the Studio route** — `src/app/studio/[[...tool]]/page.tsx`

```tsx
import { NextStudio } from "next-sanity/studio";
import config from "../../../../sanity.config";

export const dynamic = "force-static";

export { metadata, viewport } from "next-sanity/studio";

export default function StudioPage() {
  return <NextStudio config={config} />;
}
```
(The `../../../../sanity.config` path climbs `[[...tool]]` → `studio` → `app` → `src` → repo root.)

- [ ] **Step 5: Run the full test suite** (confirms the moved pages + header test still pass)

```bash
npm test
```
Expected: PASS — nav (4) + site-header (2) + assert (2) + schema (5) = 13 tests.

- [ ] **Step 6: Production build** (PRECONDITION: `.env.local` exists — see top of plan)

```bash
npm run build
```
Expected: "Compiled successfully". Routes include `/`, `/about`, and `/studio/[[...tool]]`. If the build errors on the Studio route under Next 16 / React 19 (e.g. a `styled-components` or `next-sanity/studio` issue), STOP and report the exact error rather than guessing — this is the highest-risk integration point.

- [ ] **Step 7: Lint**

```bash
npm run lint
```
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: embed Sanity Studio at /studio and move site chrome into (site) group"
```

---

## Task 6: Seed sample content (controller-run via Sanity MCP)

**This task is performed by the controller using the authenticated Sanity MCP tools, not by an implementer subagent or the CLI.** (The CLI would require interactive `sanity login`; the MCP is already authenticated. `deploy_schema` is NOT used because a local Studio exists.) Target resource: `{ projectId: "zwjctldy", dataset: "production" }`.

- [ ] **Step 1: Create the editor + taxonomy** via `create_documents_from_json`:
  - 1 `editor`: `{ name: "Jacob", email: "jacob.tobin.liberty@gmail.com" }`
  - ~3 `tag`: e.g. Dinner, Quick, Comfort food (each `{ name, slug: { _type: "slug", current: <kebab> } }`)
  - ~6 `ingredient`: e.g. ground beef (protein), onion (produce), garlic (produce), pasta (pantry), canned tomatoes (pantry), olive oil (pantry)

- [ ] **Step 2: Capture the created `_id`s** from the tool responses (they come back as `drafts.<id>`; note the published id is the same without the `drafts.` prefix).

- [ ] **Step 3: Create ~2 `recipe` documents** referencing the ids from Step 2. Each recipe: `title`, `slug`, `description`, 2–4 `ingredientLine` entries (`{ _type: "ingredientLine", ingredient: { _type: "reference", _ref: <ingredientId> }, quantity, unit }`), 3–5 `steps` (strings), `prepTime`, `cookTime`, `servings`, `tags` (references), and one `rating` (`{ _type: "rating", editor: { _ref: <editorId> }, value: 4.5 }`). Omit `images` for now (photos get added in Studio / a later phase) — note this in the report.

- [ ] **Step 4: Publish the seeded documents** with `publish_documents` so the public dataset serves them (drafts are not readable by the public API).

- [ ] **Step 5: Verify** with `query_documents` (perspective `published`):
  - `count(*[_type == "recipe"])` → ≥ 2
  - `*[_type == "recipe"]{title, "ings": ingredients[].ingredient->name, "tags": tags[]->name, ratings}` → references resolve to ingredient/tag names and ratings show the editor link.

- [ ] **Step 6: Report** the created document counts and the verification query output. (No git commit — content lives in Sanity, not the repo.)

---

## Task 7: Final verification & handoff notes

- [ ] **Step 1: Confirm the green gate** (re-run if anything changed since Task 5):

```bash
npm test && npm run build && npm run lint && npm audit
```
Expected: 13 tests pass, build compiles, lint clean, 0 vulnerabilities.

- [ ] **Step 2: Manual Studio smoke (controller reports to user as instructions; optional to run):**
  1. `npm run dev`, open `http://localhost:3000/studio`.
  2. Sign in with the Sanity account; confirm Recipe / Ingredient / Tag / Editor document types appear and the seeded content is listed.

- [ ] **Step 3: Note the optional one-time schema deploy.** For Sanity MCP type-awareness and future TypeGen, the user may run (one time):
  ```bash
  npx sanity login      # interactive, opens browser once
  npx sanity schema deploy
  ```
  This is NOT required for the app or Studio to work (Studio reads the local config; the app reads published content over the public API). Flag it as optional.

---

## Self-Review

**Spec coverage (Data Model + Authorization sections):**
- `recipe` with title/slug/description/story/images/ingredients/steps/prep+cook time/servings/tags/ratings/wishlist/madeCount/lastMadeAt/notes → Task 3 Step 7 ✓ (`createdAt` → built-in `_createdAt`, noted)
- `ingredient` (name + category) → Task 3 Step 4 ✓
- `tag` (name + slug) → Task 3 Step 5 ✓
- `editor` (name + email) as authorization allowlist → Task 3 Step 6 ✓
- ingredients as references (typo-free pantry filter) → `ingredientLine.ingredient` reference ✓
- per-editor ratings (0–5, half-steps) → `rating` object + half-step validation ✓
- Embedded Studio at `/studio` → Tasks 4–5 ✓
- Seed data for later phases → Task 6 ✓

**Placeholder scan:** No "TBD"/"add validation"-style placeholders; every code step is complete. Task 6 uses example values (intentional sample data, not placeholders) and lists exact shapes.

**Type consistency:** `schemaTypes` exported from `index.ts` and consumed by `sanity.config.ts` and `schema.test.ts`. Object type names (`ingredientLine`, `rating`, `recipeNote`) match between their definitions, `recipe`'s `of:[...]` members, and the index. `assertValue` signature matches between `assert.ts`, its test, and `env.ts`. `projectId`/`dataset`/`apiVersion` exported by `env.ts` and consumed by `sanity.config.ts`.

**Decisions called out:** relative imports under `src/sanity/**` + root config (CLI alias limitation); `_createdAt` instead of a custom field; seeding via MCP not CLI (local Studio precludes `deploy_schema`, and `sanity schema deploy` needs interactive login); images omitted from seeds for now.

**Risk notes:** (1) Studio build under Next 16 / React 19 is the highest-risk step (Task 5 Step 6) — implementer instructed to stop and report exact errors. (2) Importing `sanity`/`@sanity/icons` inside Vitest (Task 3 Step 10) could fail in jsdom — implementer instructed to report rather than delete the test.
