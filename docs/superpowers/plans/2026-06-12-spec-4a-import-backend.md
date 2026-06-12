# Spec 4a — Import Pipeline Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the server-side recipe-import pipeline: a Claude structured-output call that turns a pasted blurb into a normalized recipe draft (catalog-mapped ingredients + per-ingredient nutrients), deterministic macro assembly reusing the tested macros lib, a member-gated `importRecipe` server action, and a Convex per-user/day rate limit.

**Architecture:** `src/lib/import/` mirrors `src/lib/enrichment/` — a pure prompt + forced-tool schema + result validator + a thin Anthropic client (Haiku 4.5 → Sonnet 4.6 fallback). `assemble.ts` (pure) maps Claude's per-100g nutrients through the existing `quantityToGrams` + `sumMacros` to produce `macros.base`/`macros.full` (and exposes `computeDraftMacros` for the review form's live recompute in 4b). The `importRecipe` server action rate-limits via Convex, calls Claude, resolves each ingredient name to a catalog id (GROQ `$param`), and returns a display-ready draft (no Sanity writes — publish is 4b).

**Tech Stack:** `@anthropic-ai/sdk` (already wired), Convex (`convex-test` harness), Sanity GROQ read, Vitest. `@/` → `src/`, `@cvx/` → `convex/`.

---

## Context the implementer needs

- **Reuse, do not reimplement:**
  - `quantityToGrams(quantity, unit, name)` from `@/lib/macros/quantity-to-grams` → `{ grams: number } | { unparseable: true; reason: string }`.
  - `sumMacros(lines: MacroLine[], servings)` from `@/lib/macros/sum` → `RecipeMacros = { base, full, estimated: true, unparsedLines: string[] }`. `MacroLine = { label: string; optional: boolean; grams: number | null; per100g: Per100g | null }`. `Per100g = { calories?, protein?, carbs?, fat? }` from `@/lib/macros/nutrients`.
  - The Anthropic client pattern in `src/lib/enrichment/client.ts` (forced `tool_choice`, `cache_control` on the system block, Haiku→Sonnet retry) — mirror it.
  - `requireMember()` from `@/lib/viewer`; server→Convex via `fetchMutation`/`fetchQuery` from `convex/nextjs` + `convexAuthNextjsToken()`.
  - Convex mutation auth: `requireMembership(ctx)` from `./lib/auth` → `{ userId, householdId }`.
- **Convex test harness** (per `convex/*.test.ts`): first lines `// @vitest-environment edge-runtime` + `/// <reference types="vite/client" />`, then `const modules = import.meta.glob("./**/*.*s"); convexTest(schema, modules)`. `*.test.ts` excluded from `convex/tsconfig.json`. Commit `convex/_generated/*` alongside Convex changes.
- **Server-action test mocks** (per `kitchen-actions.test.ts`): mock `@/lib/viewer`, `convex/nextjs`, `@convex-dev/auth/nextjs/server`, `@/sanity/lib/client`, and (here) `@/lib/import/client`. Convex `api.*` proxy refs are not stable in mocks — match on args, not `fn === api.x.y`.
- Branch `design/app-overhaul-spec`; do NOT push/branch. `ANTHROPIC_API_KEY` is set locally.

---

## File Structure

**Create:**
- `src/lib/import/types.ts` — `ImportedLine`, `ImportResult`, `DraftLine`, `RecipeDraft`.
- `src/lib/import/prompt.ts` (+ `.test.ts`) — `buildImportSystemRules()`, `buildImportUserPrompt(blurb)`, `IMPORT_TOOL`.
- `src/lib/import/validate.ts` (+ `.test.ts`) — `validateImportResult(raw)`.
- `src/lib/import/assemble.ts` (+ `.test.ts`) — `gramsOf`, `computeDraftMacros`, `buildDraft`.
- `src/lib/import/client.ts` — `importRecipeBlurb(blurb)` (thin Anthropic wrapper).
- `convex/imports.ts` (+ `.test.ts`) — `importCounters` rate-limit mutation.
- `src/app/actions/import-actions.ts` (+ `.test.ts`) — `importRecipe(blurb)`.

**Modify:**
- `convex/schema.ts` — add the `importCounters` table.

---

## Task 1: Import types

**Files:**
- Create: `src/lib/import/types.ts`

- [ ] **Step 1: Create the types file**

```ts
import type { RecipeMacros } from "@/lib/macros/sum";

/** Per-100g nutrients Claude returns per ingredient (required numbers). */
export type ImportNutrients = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

/** One ingredient line as Claude returns it. */
export type ImportedLine = {
  name: string;
  quantity?: string;
  unit?: string;
  note?: string;
  optional: boolean;
  per100g: ImportNutrients;
};

/** Claude's validated structured output for a recipe. */
export type ImportResult = {
  title: string;
  description: string;
  story?: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  candidateTags: string[];
  ingredients: ImportedLine[];
  steps: string[];
};

/** An ingredient line after catalog resolution (added by the server action). */
export type DraftLine = ImportedLine & {
  catalogId: string | null;
  isNew: boolean;
};

/** The display-ready draft returned to the review form. */
export type RecipeDraft = {
  title: string;
  description: string;
  story?: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  candidateTags: string[];
  ingredients: DraftLine[];
  steps: string[];
  macros: RecipeMacros;
};
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (expect clean)

```bash
git add src/lib/import/types.ts
git commit -m "feat(4a): import pipeline types"
```

---

## Task 2: Prompt + forced tool

**Files:**
- Create: `src/lib/import/prompt.ts`, `src/lib/import/prompt.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/lib/import/prompt.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildImportSystemRules, buildImportUserPrompt, IMPORT_TOOL } from "@/lib/import/prompt";

describe("buildImportSystemRules", () => {
  const rules = buildImportSystemRules();
  it("forbids em dashes and AI tells (style guard)", () => {
    expect(rules).toMatch(/em dash|—/i);
    expect(rules.toLowerCase()).toContain("optional");
  });
  it("instructs per-100g nutrients per ingredient", () => {
    expect(rules.toLowerCase()).toMatch(/per[- ]?100\s?g/);
  });
});

describe("buildImportUserPrompt", () => {
  it("embeds the pasted blurb", () => {
    expect(buildImportUserPrompt("Grandma's chili")).toContain("Grandma's chili");
  });
});

describe("IMPORT_TOOL", () => {
  it("is a forced-tool schema with the recipe fields", () => {
    expect(IMPORT_TOOL.name).toBe("import_recipe");
    const props = IMPORT_TOOL.input_schema.properties;
    expect(Object.keys(props)).toEqual(
      expect.arrayContaining(["title", "ingredients", "steps", "candidateTags"]),
    );
    expect(IMPORT_TOOL.input_schema.required).toEqual(
      expect.arrayContaining(["title", "description", "ingredients", "steps"]),
    );
    const line = props.ingredients.items.properties;
    expect(Object.keys(line)).toEqual(
      expect.arrayContaining(["name", "optional", "per100g"]),
    );
    expect(Object.keys(line.per100g.properties)).toEqual(
      expect.arrayContaining(["calories", "protein", "carbs", "fat"]),
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/import/prompt.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement** — create `src/lib/import/prompt.ts`:

```ts
/**
 * System rules for the recipe-import call. Carries the normalization + macro
 * conventions from memory `recipe-import-process.md`, sent with cache_control so
 * repeat imports reuse the cached prefix.
 */
export function buildImportSystemRules(): string {
  return [
    "You normalize a pasted recipe blurb into a structured recipe. Use the import_recipe tool.",
    "",
    "STYLE: plain human prose. NO em dashes (—). Avoid AI tells (no 'just right', 'elevate', over-polished rule-of-three lists). Keep the cook's own voice for any story.",
    "",
    "INGREDIENTS: one entry per ingredient. Lowercase the name. Set optional=true for nice-to-have lines (notes like 'optional', 'to taste', 'to serve', 'for garnish', 'for serving'). Fill quantity + unit when given or reasonably inferable for the serving count; leave quantity blank rather than invent a wildly wrong number.",
    "",
    "NUTRIENTS: for each ingredient provide per100g macros (calories, protein, carbs, fat) for the ingredient IN THE STATE IT'S USED (raw meat on raw grams; pasta/oats/rice dry vs cooked as written). Account for consumed-vs-used context: fat strained off, salt in discarded boiling water, a marinade not fully eaten should reflect what's actually consumed. Do NOT compute recipe totals; just the per-100g values per line.",
    "",
    "STEPS: numbered method as a string array. TIMES: prepTime/cookTime in minutes; servings as a count. TAGS: candidateTags = short lowercase tag names that fit (e.g. 'dinner', 'vegetarian'); suggestions only.",
  ].join("\n");
}

export function buildImportUserPrompt(blurb: string): string {
  return `Normalize this recipe blurb into the import_recipe tool shape:\n\n${blurb}`;
}

const NUTRIENTS_SCHEMA = {
  type: "object" as const,
  properties: {
    calories: { type: "number" as const },
    protein: { type: "number" as const },
    carbs: { type: "number" as const },
    fat: { type: "number" as const },
  },
  required: ["calories", "protein", "carbs", "fat"],
};

export const IMPORT_TOOL = {
  name: "import_recipe",
  description: "Return the normalized recipe as structured fields.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: { type: "string" as const },
      description: { type: "string" as const },
      story: { type: "string" as const },
      prepTime: { type: "number" as const },
      cookTime: { type: "number" as const },
      servings: { type: "number" as const },
      candidateTags: { type: "array" as const, items: { type: "string" as const } },
      ingredients: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            name: { type: "string" as const },
            quantity: { type: "string" as const },
            unit: { type: "string" as const },
            note: { type: "string" as const },
            optional: { type: "boolean" as const },
            per100g: NUTRIENTS_SCHEMA,
          },
          required: ["name", "optional", "per100g"],
        },
      },
      steps: { type: "array" as const, items: { type: "string" as const } },
    },
    required: ["title", "description", "ingredients", "steps"],
  },
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/import/prompt.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/import/prompt.ts src/lib/import/prompt.test.ts
git commit -m "feat(4a): import prompt + forced recipe tool schema"
```

---

## Task 3: Result validation

**Files:**
- Create: `src/lib/import/validate.ts`, `src/lib/import/validate.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/lib/import/validate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateImportResult } from "@/lib/import/validate";

const ok = {
  title: "Chili",
  description: "A pot of chili.",
  servings: 4,
  candidateTags: ["dinner"],
  steps: ["Brown the beef.", "Simmer."],
  ingredients: [
    { name: "ground beef", quantity: "1", unit: "lb", optional: false,
      per100g: { calories: 215, protein: 18, carbs: 0, fat: 15 } },
    { name: "cilantro", optional: true,
      per100g: { calories: 23, protein: 2, carbs: 4, fat: 0 } },
  ],
};

describe("validateImportResult", () => {
  it("accepts a well-formed result and normalizes optional/arrays", () => {
    const res = validateImportResult(ok);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.title).toBe("Chili");
      expect(res.value.ingredients).toHaveLength(2);
      expect(res.value.ingredients[1].optional).toBe(true);
      expect(res.value.candidateTags).toEqual(["dinner"]);
    }
  });

  it("rejects missing title or empty ingredients", () => {
    expect(validateImportResult({ ...ok, title: "" }).ok).toBe(false);
    expect(validateImportResult({ ...ok, ingredients: [] }).ok).toBe(false);
  });

  it("rejects an ingredient missing per100g numbers", () => {
    const bad = { ...ok, ingredients: [{ name: "x", optional: false, per100g: { calories: 1 } }] };
    expect(validateImportResult(bad).ok).toBe(false);
  });

  it("rejects a non-object", () => {
    expect(validateImportResult(null).ok).toBe(false);
    expect(validateImportResult("nope").ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/import/validate.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement** — create `src/lib/import/validate.ts`:

```ts
import type { ImportResult, ImportedLine, ImportNutrients } from "@/lib/import/types";

export type ImportValidation =
  | { ok: true; value: ImportResult }
  | { ok: false; errors: string[] };

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const str = (x: unknown): string => (typeof x === "string" ? x : "");
const optStr = (x: unknown): string | undefined =>
  typeof x === "string" && x.trim() ? x : undefined;
const optNum = (x: unknown): number | undefined => (isNum(x) ? x : undefined);

function nutrients(raw: unknown): ImportNutrients | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!isNum(r.calories) || !isNum(r.protein) || !isNum(r.carbs) || !isNum(r.fat)) return null;
  return { calories: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fat };
}

export function validateImportResult(raw: unknown): ImportValidation {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, errors: ["result is not an object"] };
  }
  const r = raw as Record<string, unknown>;

  const title = str(r.title).trim();
  if (!title) errors.push("title is required");
  const description = str(r.description).trim();

  const rawIngredients = Array.isArray(r.ingredients) ? r.ingredients : [];
  const ingredients: ImportedLine[] = [];
  for (const [i, raw] of rawIngredients.entries()) {
    if (typeof raw !== "object" || raw === null) { errors.push(`ingredient ${i} not an object`); continue; }
    const ing = raw as Record<string, unknown>;
    const name = str(ing.name).trim();
    const per100g = nutrients(ing.per100g);
    if (!name) { errors.push(`ingredient ${i} missing name`); continue; }
    if (!per100g) { errors.push(`ingredient ${i} (${name}) missing per100g`); continue; }
    ingredients.push({
      name,
      quantity: optStr(ing.quantity),
      unit: optStr(ing.unit),
      note: optStr(ing.note),
      optional: ing.optional === true,
      per100g,
    });
  }
  if (ingredients.length === 0) errors.push("at least one valid ingredient is required");

  const steps = Array.isArray(r.steps) ? r.steps.map(str).map((s) => s.trim()).filter(Boolean) : [];
  const candidateTags = Array.isArray(r.candidateTags)
    ? r.candidateTags.map(str).map((s) => s.trim().toLowerCase()).filter(Boolean)
    : [];

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      title,
      description,
      story: optStr(r.story),
      prepTime: optNum(r.prepTime),
      cookTime: optNum(r.cookTime),
      servings: optNum(r.servings),
      candidateTags,
      ingredients,
      steps,
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/import/validate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/import/validate.ts src/lib/import/validate.test.ts
git commit -m "feat(4a): validate import result before use"
```

---

## Task 4: Assembly — grams + macros + draft shaping

**Files:**
- Create: `src/lib/import/assemble.ts`, `src/lib/import/assemble.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/lib/import/assemble.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { gramsOf, computeDraftMacros, buildDraft } from "@/lib/import/assemble";
import type { ImportResult, ImportedLine } from "@/lib/import/types";

const beef: ImportedLine = {
  name: "ground beef", quantity: "1", unit: "lb", optional: false,
  per100g: { calories: 215, protein: 18, carbs: 0, fat: 15 },
};
const herb: ImportedLine = {
  name: "cilantro", quantity: "10", unit: "g", optional: true,
  per100g: { calories: 23, protein: 2, carbs: 4, fat: 0 },
};
const pinch: ImportedLine = {
  name: "salt", quantity: "a pinch", optional: false,
  per100g: { calories: 0, protein: 0, carbs: 0, fat: 0 },
};

describe("gramsOf", () => {
  it("converts a parseable line to grams", () => {
    expect(gramsOf(beef)).toBeCloseTo(453.6, 1); // 1 lb
  });
  it("returns null when the amount can't be parsed", () => {
    expect(gramsOf(pinch)).toBeNull();
  });
});

describe("computeDraftMacros", () => {
  it("excludes optional from base, includes it in full, flags unparsed", () => {
    const m = computeDraftMacros([beef, herb, pinch], 2);
    expect(m.base.calories).toBeGreaterThan(0);
    expect(m.full.calories).toBeGreaterThan(m.base.calories); // herb (optional) adds to full
    expect(m.unparsedLines).toContain("salt");
    expect(m.estimated).toBe(true);
  });
});

describe("buildDraft", () => {
  it("attaches catalog matches and computes macros", () => {
    const result: ImportResult = {
      title: "Chili", description: "Hot.", servings: 2,
      candidateTags: ["dinner"], steps: ["Cook."], ingredients: [beef, herb],
    };
    const catalogByName = new Map([["ground beef", "beef-id"]]); // herb is new
    const draft = buildDraft(result, catalogByName);
    expect(draft.ingredients[0]).toMatchObject({ name: "ground beef", catalogId: "beef-id", isNew: false });
    expect(draft.ingredients[1]).toMatchObject({ name: "cilantro", catalogId: null, isNew: true });
    expect(draft.macros.full.calories).toBeGreaterThan(0);
    expect(draft.candidateTags).toEqual(["dinner"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/import/assemble.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement** — create `src/lib/import/assemble.ts`:

```ts
import { quantityToGrams } from "@/lib/macros/quantity-to-grams";
import { sumMacros, type MacroLine, type RecipeMacros } from "@/lib/macros/sum";
import type { ImportResult, ImportedLine, RecipeDraft, DraftLine } from "@/lib/import/types";

/** Grams for an imported line, or null when the amount can't be parsed. */
export function gramsOf(line: ImportedLine): number | null {
  const res = quantityToGrams(line.quantity, line.unit, line.name);
  return "grams" in res ? res.grams : null;
}

/**
 * Per-serving macros for a set of imported lines, computed deterministically
 * from each line's grams + per-100g nutrients. Reused live by the review form.
 */
export function computeDraftMacros(
  ingredients: ImportedLine[],
  servings: number | null | undefined,
): RecipeMacros {
  const lines: MacroLine[] = ingredients.map((i) => ({
    label: i.name,
    optional: i.optional,
    grams: gramsOf(i),
    per100g: i.per100g,
  }));
  return sumMacros(lines, servings);
}

/** Resolve catalog matches + compute macros into a display-ready draft. */
export function buildDraft(
  result: ImportResult,
  catalogByName: Map<string, string>,
): RecipeDraft {
  const ingredients: DraftLine[] = result.ingredients.map((i) => {
    const catalogId = catalogByName.get(i.name.toLowerCase()) ?? null;
    return { ...i, catalogId, isNew: catalogId === null };
  });
  return {
    title: result.title,
    description: result.description,
    story: result.story,
    prepTime: result.prepTime,
    cookTime: result.cookTime,
    servings: result.servings,
    candidateTags: result.candidateTags,
    ingredients,
    steps: result.steps,
    macros: computeDraftMacros(result.ingredients, result.servings),
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/import/assemble.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/import/assemble.ts src/lib/import/assemble.test.ts
git commit -m "feat(4a): assemble draft (catalog match + deterministic macros)"
```

---

## Task 5: Anthropic client wrapper

**Files:**
- Create: `src/lib/import/client.ts`

- [ ] **Step 1: Implement** — create `src/lib/import/client.ts` (mirrors `src/lib/enrichment/client.ts`; no dedicated unit test — exercised via the action test in Task 7, which mocks this module):

```ts
import Anthropic from "@anthropic-ai/sdk";
import { buildImportSystemRules, buildImportUserPrompt, IMPORT_TOOL } from "@/lib/import/prompt";

const HAIKU = "claude-haiku-4-5";
const SONNET = "claude-sonnet-4-6";
type ImportModel = typeof HAIKU | typeof SONNET;

/**
 * Call Claude once to normalize a blurb. Returns the raw tool input (caller
 * validates via validateImportResult). System rules are cached; falls back to
 * Sonnet if Haiku returns no usable tool_use.
 */
export async function importRecipeBlurb(
  blurb: string,
  opts: { model?: ImportModel } = {},
): Promise<unknown> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY
  const model: ImportModel = opts.model ?? HAIKU;

  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    system: [
      { type: "text", text: buildImportSystemRules(), cache_control: { type: "ephemeral" } },
    ],
    tools: [IMPORT_TOOL as Anthropic.Tool],
    tool_choice: { type: "tool", name: IMPORT_TOOL.name },
    messages: [{ role: "user", content: buildImportUserPrompt(blurb) }],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    if (model !== SONNET) return importRecipeBlurb(blurb, { model: SONNET });
    throw new Error("Import: no tool_use block in response");
  }
  return toolUse.input;
}

export { HAIKU, SONNET };
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (expect clean)

```bash
git add src/lib/import/client.ts
git commit -m "feat(4a): Anthropic import client (forced tool, Haiku->Sonnet)"
```

---

## Task 6: Convex per-user/day rate limit

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/imports.ts`, `convex/imports.test.ts`

- [ ] **Step 1: Add the table to `convex/schema.ts`.** Add this table definition alongside the existing ones (inside the `defineSchema({...})` object):

```ts
  importCounters: defineTable({
    userId: v.string(),
    dayKey: v.string(), // UTC YYYY-MM-DD, supplied by the caller
    count: v.number(),
  }).index("by_user_day", ["userId", "dayKey"]),
```

(Ensure `defineTable` and `v` are already imported at the top of `schema.ts` — they are, used by the other tables.)

- [ ] **Step 2: Write the failing test** — create `convex/imports.test.ts`:

```ts
// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

// Helper: seed an authed user with a household membership so requireMembership passes.
async function asMember(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) => {
    const uid = await ctx.db.insert("users", { name: "Tester" });
    const hid = await ctx.db.insert("households", { name: "H", ownerId: uid });
    await ctx.db.insert("memberships", { userId: uid, householdId: hid, role: "owner" });
    return uid;
  });
  return t.withIdentity({ subject: userId });
}

describe("recordImport", () => {
  it("increments per user+day and rejects past the cap", async () => {
    const t = convexTest(schema, modules);
    const as = await asMember(t);
    // CAP is 25 — first call ok, count becomes 1
    await as.mutation(api.imports.recordImport, { dayKey: "2026-06-12" });
    const row = await t.run((ctx) =>
      ctx.db.query("importCounters").withIndex("by_user_day", (q) => q.eq("userId", undefined as never).eq("dayKey", "2026-06-12")).collect(),
    );
    // Drive to the cap then expect rejection
    for (let i = 1; i < 25; i++) await as.mutation(api.imports.recordImport, { dayKey: "2026-06-12" });
    await expect(as.mutation(api.imports.recordImport, { dayKey: "2026-06-12" })).rejects.toThrow(/limit/i);
    // A different day resets
    await as.mutation(api.imports.recordImport, { dayKey: "2026-06-13" });
  });

  it("rejects a non-member", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.imports.recordImport, { dayKey: "2026-06-12" }),
    ).rejects.toThrow();
  });
});
```

> Note: the `t.run(... withIndex eq("userId", undefined ...))` line above is just an illustrative read and is not asserted on; if it complicates the test, delete that block — the cap-then-reject assertions are the real coverage. Match the seed shape (`users`/`households`/`memberships` fields) to the ACTUAL Convex schema by reading `convex/schema.ts` + `convex/households.ts` first; adjust field names if they differ (e.g. household may need more required fields). The auth seed pattern mirrors existing `convex/*.test.ts`.

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run convex/imports.test.ts`
Expected: FAIL — `api.imports` undefined / function missing.

- [ ] **Step 4: Implement** — create `convex/imports.ts`:

```ts
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireMembership } from "./lib/auth";

const DAILY_CAP = 25;

/**
 * Record one recipe import for the calling user on `dayKey` (UTC YYYY-MM-DD,
 * computed by the server action). Throws once the per-user daily cap is hit.
 */
export const recordImport = mutation({
  args: { dayKey: v.string() },
  handler: async (ctx, { dayKey }) => {
    const { userId } = await requireMembership(ctx);
    const existing = await ctx.db
      .query("importCounters")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("dayKey", dayKey))
      .first();
    const count = existing?.count ?? 0;
    if (count >= DAILY_CAP) {
      throw new Error("Daily import limit reached. Try again tomorrow.");
    }
    if (existing) {
      await ctx.db.patch(existing._id, { count: count + 1 });
    } else {
      await ctx.db.insert("importCounters", { userId, dayKey, count: 1 });
    }
  },
});
```

- [ ] **Step 5: Run + regen Convex types**

Run: `npx convex dev --once` (regenerates `convex/_generated/*` so `api.imports` exists), then `npx vitest run convex/imports.test.ts`
Expected: deploys clean; tests PASS. If the seed shape in the test mismatches the real schema, fix the test seed (not the schema) per the note in Step 2.

- [ ] **Step 6: Commit**

```bash
git add convex/schema.ts convex/imports.ts convex/imports.test.ts convex/_generated
git commit -m "feat(4a): per-user/day import rate limit (Convex)"
```

---

## Task 7: `importRecipe` server action

**Files:**
- Create: `src/app/actions/import-actions.ts`, `src/app/actions/import-actions.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/app/actions/import-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/viewer", () => ({ requireMember: vi.fn() }));
vi.mock("@convex-dev/auth/nextjs/server", () => ({
  convexAuthNextjsToken: vi.fn().mockResolvedValue("tok"),
}));
const fetchMutation = vi.fn().mockResolvedValue(undefined);
vi.mock("convex/nextjs", () => ({ fetchMutation: (...a: unknown[]) => fetchMutation(...a) }));
const sanityFetch = vi.fn();
vi.mock("@/sanity/lib/client", () => ({
  client: { withConfig: () => ({ fetch: (...a: unknown[]) => sanityFetch(...a) }) },
}));
const importRecipeBlurb = vi.fn();
vi.mock("@/lib/import/client", () => ({ importRecipeBlurb: (...a: unknown[]) => importRecipeBlurb(...a) }));

import { requireMember } from "@/lib/viewer";
import { importRecipe } from "@/app/actions/import-actions";

const RAW = {
  title: "Chili", description: "Hot.", servings: 2, candidateTags: ["dinner"], steps: ["Cook."],
  ingredients: [
    { name: "ground beef", quantity: "1", unit: "lb", optional: false, per100g: { calories: 215, protein: 18, carbs: 0, fat: 15 } },
    { name: "cilantro", quantity: "10", unit: "g", optional: true, per100g: { calories: 23, protein: 2, carbs: 4, fat: 0 } },
  ],
};

beforeEach(() => {
  vi.mocked(requireMember).mockResolvedValue({ userId: "u1", householdId: "h1" });
  fetchMutation.mockClear();
  sanityFetch.mockReset();
  importRecipeBlurb.mockReset();
});

describe("importRecipe", () => {
  it("rate-limits, calls Claude, resolves catalog matches, returns a draft", async () => {
    importRecipeBlurb.mockResolvedValueOnce(RAW);
    // catalog lookup: ground beef matches, cilantro is new
    sanityFetch.mockResolvedValueOnce([{ _id: "beef-id", name: "ground beef" }]);

    const res = await importRecipe("Grandma's chili");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.draft.title).toBe("Chili");
      const beef = res.draft.ingredients.find((i) => i.name === "ground beef");
      expect(beef).toMatchObject({ catalogId: "beef-id", isNew: false });
      const herb = res.draft.ingredients.find((i) => i.name === "cilantro");
      expect(herb).toMatchObject({ catalogId: null, isNew: true });
      expect(res.draft.macros.full.calories).toBeGreaterThan(0);
    }
    // rate limit recorded
    expect(fetchMutation).toHaveBeenCalled();
  });

  it("returns an error result when Claude output is invalid (no publish path hit)", async () => {
    importRecipeBlurb.mockResolvedValueOnce({ title: "", ingredients: [] });
    const res = await importRecipe("garbage");
    expect(res.ok).toBe(false);
  });

  it("propagates the rate-limit rejection", async () => {
    fetchMutation.mockRejectedValueOnce(new Error("Daily import limit reached."));
    await expect(importRecipe("x")).rejects.toThrow(/limit/i);
  });

  it("rejects a non-member", async () => {
    vi.mocked(requireMember).mockRejectedValueOnce(new Error("Not authorized"));
    await expect(importRecipe("x")).rejects.toThrow(/authorized/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/app/actions/import-actions.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement** — create `src/app/actions/import-actions.ts`:

```ts
"use server";

import { fetchMutation } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@cvx/_generated/api";
import { client } from "@/sanity/lib/client";
import { requireMember } from "@/lib/viewer";
import { importRecipeBlurb } from "@/lib/import/client";
import { validateImportResult } from "@/lib/import/validate";
import { buildDraft } from "@/lib/import/assemble";
import type { RecipeDraft } from "@/lib/import/types";

const reader = () => client.withConfig({ useCdn: false });

export type ImportRecipeResult =
  | { ok: true; draft: RecipeDraft }
  | { ok: false; error: string };

/**
 * Member-gated: rate-limit, normalize a blurb via Claude, resolve catalog
 * matches, and return a display-ready draft. No Sanity writes (publish is 4b).
 */
export async function importRecipe(blurb: string): Promise<ImportRecipeResult> {
  await requireMember();

  const clean = (blurb ?? "").trim();
  if (!clean) return { ok: false, error: "Paste a recipe to import." };

  // Rate limit (per-user/day). The day key is computed here (Date is fine in a
  // server action) and passed to the Convex mutation. Throws past the cap.
  const token = await convexAuthNextjsToken();
  const dayKey = new Date().toISOString().slice(0, 10);
  await fetchMutation(api.imports.recordImport, { dayKey }, token ? { token } : {});

  const raw = await importRecipeBlurb(clean);
  const validation = validateImportResult(raw);
  if (!validation.ok) {
    return { ok: false, error: "Couldn't read that recipe. Try adding more detail." };
  }

  // Resolve catalog ids by lower-cased name (parameterized GROQ).
  const names = [...new Set(validation.value.ingredients.map((i) => i.name.toLowerCase()))];
  const matches =
    names.length > 0
      ? ((await reader().fetch<{ _id: string; name: string }[]>(
          `*[_type == "ingredient" && lower(name) in $names]{ _id, name }`,
          { names },
        )) ?? [])
      : [];
  const catalogByName = new Map(matches.map((m) => [m.name.toLowerCase(), m._id]));

  return { ok: true, draft: buildDraft(validation.value, catalogByName) };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/app/actions/import-actions.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Full gate + commit**

Run: `npx vitest run && npm run lint && npx tsc --noEmit`
Expected: all green.

```bash
git add src/app/actions/import-actions.ts src/app/actions/import-actions.test.ts
git commit -m "feat(4a): importRecipe action (rate-limit + Claude + catalog resolve -> draft)"
```

---

## Post-implementation gate (whole sub-plan)

- [ ] Full gate green: `npx vitest run` + `npm run lint` + `npx tsc --noEmit` + `npx convex dev --once`.
- [ ] Holistic review across the 4a commits; address findings.
- [ ] Confirm: `importRecipe` is member-gated + rate-limited; invalid Claude output returns a friendly error (never throws raw); catalog matches resolve by lower(name); macros compute base-vs-full with `unparsedLines`; `computeDraftMacros` is exported for the 4b form's live recompute.

---

## Self-review notes (coverage vs Spec 4 design §3, §4, §7)

- §3 Claude call (forced tool, prompt-cached rules, Haiku→Sonnet, per-100g nutrients) → Tasks 2, 5.
- §4 deterministic assembly (catalog map by lower(name); `quantityToGrams`×`per100g`→`sumMacros` base/full + `unparsedLines`) → Tasks 4, 7.
- §3 validation (Sonnet fallback in client; `validateImportResult` before use) → Tasks 3, 5, 7.
- §7 rate limit (Convex per-user/day) → Task 6 + wired in Task 7.
- `computeDraftMacros` exported for 4b live recompute → Task 4.
- Out of 4a scope (later sub-plans): the `/submit` UI + review form + `publishRecipe` + cover gen (4b); edit/re-import + retire manual form (4c). No Sanity writes in 4a.
