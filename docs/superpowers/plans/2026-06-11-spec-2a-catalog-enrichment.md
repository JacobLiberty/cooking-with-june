# Spec 2a — Catalog stock-metadata + Claude enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add stock-metadata fields to the Sanity `ingredient` catalog and build a tested, idempotent, run-once Claude enrichment pass that populates those fields for every existing ingredient.

**Architecture:** Schema fields are all optional (existing docs stay valid). The decision logic, heuristic fallback, and result validation live as **pure, unit-tested functions** in `src/lib/enrichment/`. A committed, idempotent `scripts/enrich-ingredients.ts` is thin glue that wires Sanity read → Anthropic call (Haiku 4.5 default, Sonnet 4.6 fallback, prompt-cached rules, structured output) → validate + fallback-merge → Sanity write. The owner runs it once.

**Tech Stack:** Sanity schema (`sanity` lib), TypeScript, Vitest (`tsconfigPaths` resolves `@/`), new dep `@anthropic-ai/sdk`, new dev dep `tsx`, Sanity write path via `getWriteClient()`. Script run with `node --import tsx --env-file=.env.local scripts/enrich-ingredients.ts`.

**Parent spec:** [docs/superpowers/specs/2026-06-11-cooking-with-june-spec-2-pantry-design.md](../specs/2026-06-11-cooking-with-june-spec-2-pantry-design.md) §5.

**Pre-req the owner must do before running the script (Task 7):** set `ANTHROPIC_API_KEY` in `.env.local` (the agent cannot write `.env*` files). The Sanity write token `SANITY_API_WRITE_TOKEN` is already used by `getWriteClient()`.

**New-dependency note (raise with owner at Task 5):** this plan adds `@anthropic-ai/sdk` (runtime) and `tsx` (dev). Both were implied by the approved "full Claude-API enrichment" decision, but confirm before installing.

---

## File Structure

- `src/sanity/schemaTypes/documents/ingredient.ts` — **modify**: add stock-metadata fields + `nonfood` category.
- `src/sanity/schemaTypes/schema.test.ts` — **modify**: assert the new fields.
- `src/lib/enrichment/types.ts` — **create**: shared types for stock metadata.
- `src/lib/enrichment/select.ts` + `select.test.ts` — **create**: which ingredients need enrichment.
- `src/lib/enrichment/fallback.ts` + `fallback.test.ts` — **create**: heuristic fallback from `src/lib/macros/units.ts`, and merge-with-fallback.
- `src/lib/enrichment/validate.ts` + `validate.test.ts` — **create**: validate/repair a raw enrichment result.
- `src/lib/enrichment/prompt.ts` + `prompt.test.ts` — **create**: cached system rules, user prompt, JSON schema constant.
- `src/lib/enrichment/client.ts` — **create**: thin Anthropic wrapper (I/O glue, not unit-tested).
- `scripts/enrich-ingredients.ts` — **create**: the run-once runner.
- `package.json` — **modify**: add deps + the `enrich:ingredients` script.

All pure logic is in `src/lib/enrichment/`; the script and `client.ts` are the only I/O.

---

## Task 1: Stock-metadata fields on the ingredient schema

**Files:**
- Modify: `src/sanity/schemaTypes/documents/ingredient.ts`
- Test: `src/sanity/schemaTypes/schema.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/sanity/schemaTypes/schema.test.ts` (import `ingredient` at the top alongside `recipe`: `import { ingredient } from "@/sanity/schemaTypes/documents/ingredient";`):

```ts
describe("ingredient stock metadata (Spec 2a)", () => {
  const names = ingredient.fields.map((f) => f.name);

  it("has the stock-metadata fields", () => {
    expect(names).toEqual(
      expect.arrayContaining([
        "canonicalUnitKind",
        "density",
        "avgUnitGrams",
        "restockQuantity",
      ]),
    );
  });

  it("category list includes nonfood", () => {
    const category = ingredient.fields.find((f) => f.name === "category");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values = (category as any).options.list.map((o: any) => o.value);
    expect(values).toContain("nonfood");
  });

  it("canonicalUnitKind is constrained to mass/volume/count", () => {
    const kind = ingredient.fields.find((f) => f.name === "canonicalUnitKind");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values = (kind as any).options.list.map((o: any) => o.value);
    expect(values).toEqual(["mass", "volume", "count"]);
  });

  it("restockQuantity is an object with quantity + unit", () => {
    const restock = ingredient.fields.find((f) => f.name === "restockQuantity");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub = (restock as any).fields.map((f: any) => f.name);
    expect(sub).toEqual(expect.arrayContaining(["quantity", "unit"]));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/sanity/schemaTypes/schema.test.ts`
Expected: FAIL — new fields not present / `category` has no `nonfood`.

- [ ] **Step 3: Add the fields to the schema**

In `src/sanity/schemaTypes/documents/ingredient.ts`, add `{ title: "Non-food", value: "nonfood" }` to the existing `category` options `list`, and append these fields after `category` (inside the `fields` array):

```ts
    defineField({
      name: "canonicalUnitKind",
      title: "Canonical unit kind",
      type: "string",
      description: "How this ingredient is fundamentally measured.",
      options: {
        list: [
          { title: "Mass", value: "mass" },
          { title: "Volume", value: "volume" },
          { title: "Count", value: "count" },
        ],
      },
    }),
    defineField({
      name: "density",
      title: "Density (g/ml)",
      type: "number",
      description: "Only meaningful for volume-kind ingredients (e.g. flour 0.53).",
    }),
    defineField({
      name: "avgUnitGrams",
      title: "Average grams per item",
      type: "number",
      description: "Only meaningful for count-kind ingredients (e.g. egg 50).",
    }),
    defineField({
      name: "restockQuantity",
      title: "Default restock quantity",
      type: "object",
      description: 'A typical purchase, e.g. 1 "dozen" or 5 "lb".',
      fields: [
        defineField({ name: "quantity", title: "Quantity", type: "number" }),
        defineField({ name: "unit", title: "Unit", type: "string" }),
      ],
    }),
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/sanity/schemaTypes/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sanity/schemaTypes/documents/ingredient.ts src/sanity/schemaTypes/schema.test.ts
git commit -m "feat(2a): add stock-metadata fields + nonfood category to ingredient schema"
```

---

## Task 2: Enrichment types + selection logic

**Files:**
- Create: `src/lib/enrichment/types.ts`
- Create: `src/lib/enrichment/select.ts`
- Test: `src/lib/enrichment/select.test.ts`

- [ ] **Step 1: Create the shared types**

`src/lib/enrichment/types.ts`:

```ts
export type CanonicalUnitKind = "mass" | "volume" | "count";

export type RestockQuantity = { quantity: number; unit: string };

export type IngredientCategory =
  | "produce"
  | "protein"
  | "dairy"
  | "pantry"
  | "spice"
  | "other"
  | "nonfood";

/** The stock metadata Spec 2 depletion needs on every catalog ingredient. */
export type StockMetadata = {
  canonicalUnitKind: CanonicalUnitKind;
  density?: number; // volume-kind only
  avgUnitGrams?: number; // count-kind only
  restockQuantity: RestockQuantity;
  category: IngredientCategory;
};

/** A catalog ingredient doc as read from Sanity (only fields we touch here). */
export type IngredientDoc = {
  _id: string;
  name: string;
  category?: string;
  canonicalUnitKind?: string;
  density?: number;
  avgUnitGrams?: number;
  restockQuantity?: { quantity?: number; unit?: string };
};
```

- [ ] **Step 2: Write the failing test**

`src/lib/enrichment/select.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ingredientNeedsEnrichment, selectIngredientsNeedingEnrichment } from "@/lib/enrichment/select";
import type { IngredientDoc } from "@/lib/enrichment/types";

const complete: IngredientDoc = {
  _id: "a",
  name: "flour",
  category: "pantry",
  canonicalUnitKind: "volume",
  density: 0.53,
  restockQuantity: { quantity: 5, unit: "lb" },
};

describe("ingredientNeedsEnrichment", () => {
  it("false when all required metadata present", () => {
    expect(ingredientNeedsEnrichment(complete)).toBe(false);
  });

  it("true when canonicalUnitKind missing", () => {
    expect(ingredientNeedsEnrichment({ ...complete, canonicalUnitKind: undefined })).toBe(true);
  });

  it("true when restockQuantity incomplete", () => {
    expect(ingredientNeedsEnrichment({ ...complete, restockQuantity: { quantity: 5 } })).toBe(true);
  });

  it("true when category missing", () => {
    expect(ingredientNeedsEnrichment({ ...complete, category: undefined })).toBe(true);
  });

  it("count-kind needs avgUnitGrams, volume-kind needs density", () => {
    expect(
      ingredientNeedsEnrichment({ ...complete, canonicalUnitKind: "count", density: undefined, avgUnitGrams: undefined }),
    ).toBe(true);
    expect(
      ingredientNeedsEnrichment({ ...complete, canonicalUnitKind: "count", density: undefined, avgUnitGrams: 50 }),
    ).toBe(false);
    // mass-kind needs neither density nor avgUnitGrams
    expect(
      ingredientNeedsEnrichment({ ...complete, canonicalUnitKind: "mass", density: undefined, avgUnitGrams: undefined }),
    ).toBe(false);
  });
});

describe("selectIngredientsNeedingEnrichment", () => {
  const docs: IngredientDoc[] = [complete, { _id: "b", name: "egg" }];

  it("returns only docs missing metadata", () => {
    expect(selectIngredientsNeedingEnrichment(docs).map((d) => d._id)).toEqual(["b"]);
  });

  it("force=true returns all docs", () => {
    expect(selectIngredientsNeedingEnrichment(docs, { force: true }).map((d) => d._id)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- src/lib/enrichment/select.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

`src/lib/enrichment/select.ts`:

```ts
import type { IngredientDoc } from "@/lib/enrichment/types";

/** True when a catalog ingredient is missing any metadata depletion needs. */
export function ingredientNeedsEnrichment(doc: IngredientDoc): boolean {
  if (!doc.category) return true;
  const kind = doc.canonicalUnitKind;
  if (kind !== "mass" && kind !== "volume" && kind !== "count") return true;
  if (kind === "volume" && typeof doc.density !== "number") return true;
  if (kind === "count" && typeof doc.avgUnitGrams !== "number") return true;
  const r = doc.restockQuantity;
  if (!r || typeof r.quantity !== "number" || !r.unit) return true;
  return false;
}

export function selectIngredientsNeedingEnrichment(
  docs: IngredientDoc[],
  opts: { force?: boolean } = {},
): IngredientDoc[] {
  if (opts.force) return docs;
  return docs.filter(ingredientNeedsEnrichment);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- src/lib/enrichment/select.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/enrichment/types.ts src/lib/enrichment/select.ts src/lib/enrichment/select.test.ts
git commit -m "feat(2a): enrichment types + ingredient selection logic"
```

---

## Task 3: Heuristic fallback from the macros lib

**Files:**
- Create: `src/lib/enrichment/fallback.ts`
- Test: `src/lib/enrichment/fallback.test.ts`

This reuses the existing tested heuristics in `src/lib/macros/units.ts` (`densityFor`, `countWeightFor`) so the fallback agrees with the conversion lib, and fills any field Claude omits.

- [ ] **Step 1: Write the failing test**

`src/lib/enrichment/fallback.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { fallbackMetadata, mergeWithFallback } from "@/lib/enrichment/fallback";

describe("fallbackMetadata", () => {
  it("count-kind for a known count ingredient (egg)", () => {
    const fb = fallbackMetadata("egg");
    expect(fb.canonicalUnitKind).toBe("count");
    expect(fb.avgUnitGrams).toBe(50);
  });

  it("volume-kind with density for a known density ingredient (flour)", () => {
    const fb = fallbackMetadata("all-purpose flour");
    expect(fb.canonicalUnitKind).toBe("volume");
    expect(fb.density).toBe(0.53);
  });

  it("no kind guess for an unknown ingredient", () => {
    const fb = fallbackMetadata("dragonfruit");
    expect(fb.canonicalUnitKind).toBeUndefined();
  });
});

describe("mergeWithFallback", () => {
  it("fills missing avgUnitGrams from the fallback", () => {
    const merged = mergeWithFallback(
      { canonicalUnitKind: "count", category: "produce", restockQuantity: { quantity: 12, unit: "" } },
      "egg",
    );
    expect(merged.avgUnitGrams).toBe(50);
  });

  it("does not overwrite values the model supplied", () => {
    const merged = mergeWithFallback(
      { canonicalUnitKind: "count", avgUnitGrams: 55, category: "produce", restockQuantity: { quantity: 12, unit: "" } },
      "egg",
    );
    expect(merged.avgUnitGrams).toBe(55);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/enrichment/fallback.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/enrichment/fallback.ts`:

```ts
import { densityFor, countWeightFor } from "@/lib/macros/units";
import type { CanonicalUnitKind } from "@/lib/enrichment/types";

type Partial2 = {
  canonicalUnitKind?: CanonicalUnitKind;
  density?: number;
  avgUnitGrams?: number;
};

/**
 * Best-effort metadata from the name-substring heuristics, used only to fill
 * gaps the model leaves. Returns nothing it can't infer (so unknown names get
 * an empty hint and rely on the model).
 */
export function fallbackMetadata(name: string): Partial2 {
  const countWeight = countWeightFor(name, "");
  if (countWeight != null) {
    return { canonicalUnitKind: "count", avgUnitGrams: countWeight };
  }
  const density = densityFor(name);
  if (density !== 1) {
    return { canonicalUnitKind: "volume", density };
  }
  return {};
}

/** Fill only the fields missing from `result` using the heuristic fallback. */
export function mergeWithFallback<T extends Partial2>(result: T, name: string): T {
  const fb = fallbackMetadata(name);
  return {
    ...result,
    canonicalUnitKind: result.canonicalUnitKind ?? fb.canonicalUnitKind,
    density: result.density ?? fb.density,
    avgUnitGrams: result.avgUnitGrams ?? fb.avgUnitGrams,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/lib/enrichment/fallback.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/enrichment/fallback.ts src/lib/enrichment/fallback.test.ts
git commit -m "feat(2a): heuristic enrichment fallback from macros units lib"
```

---

## Task 4: Validate / repair a raw enrichment result

**Files:**
- Create: `src/lib/enrichment/validate.ts`
- Test: `src/lib/enrichment/validate.test.ts`

The model returns one object per ingredient. Validate the shape before writing to Sanity (never trust external data). The validator returns a typed `StockMetadata` or a list of errors.

- [ ] **Step 1: Write the failing test**

`src/lib/enrichment/validate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateEnrichmentResult } from "@/lib/enrichment/validate";

const valid = {
  canonicalUnitKind: "count",
  avgUnitGrams: 50,
  restockQuantity: { quantity: 12, unit: "" },
  category: "produce",
};

describe("validateEnrichmentResult", () => {
  it("accepts a well-formed count result", () => {
    const r = validateEnrichmentResult(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.avgUnitGrams).toBe(50);
  });

  it("rejects an unknown canonicalUnitKind", () => {
    const r = validateEnrichmentResult({ ...valid, canonicalUnitKind: "blob" });
    expect(r.ok).toBe(false);
  });

  it("rejects a non-positive avgUnitGrams", () => {
    const r = validateEnrichmentResult({ ...valid, avgUnitGrams: 0 });
    expect(r.ok).toBe(false);
  });

  it("rejects a missing restock quantity", () => {
    const r = validateEnrichmentResult({ ...valid, restockQuantity: { unit: "lb" } });
    expect(r.ok).toBe(false);
  });

  it("rejects an unknown category", () => {
    const r = validateEnrichmentResult({ ...valid, category: "snacks" });
    expect(r.ok).toBe(false);
  });

  it("rejects a non-object", () => {
    expect(validateEnrichmentResult(null).ok).toBe(false);
    expect(validateEnrichmentResult("x").ok).toBe(false);
  });

  it("volume-kind requires a positive density", () => {
    expect(validateEnrichmentResult({ canonicalUnitKind: "volume", restockQuantity: { quantity: 1, unit: "l" }, category: "pantry" }).ok).toBe(false);
    expect(validateEnrichmentResult({ canonicalUnitKind: "volume", density: 0.9, restockQuantity: { quantity: 1, unit: "l" }, category: "pantry" }).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/enrichment/validate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/enrichment/validate.ts`:

```ts
import type { StockMetadata, IngredientCategory } from "@/lib/enrichment/types";

const KINDS = ["mass", "volume", "count"] as const;
const CATEGORIES: IngredientCategory[] = [
  "produce", "protein", "dairy", "pantry", "spice", "other", "nonfood",
];

export type ValidationResult =
  | { ok: true; value: StockMetadata }
  | { ok: false; errors: string[] };

const isPosNumber = (x: unknown): x is number =>
  typeof x === "number" && Number.isFinite(x) && x > 0;

export function validateEnrichmentResult(raw: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, errors: ["result is not an object"] };
  }
  const r = raw as Record<string, unknown>;

  const kind = r.canonicalUnitKind;
  if (typeof kind !== "string" || !(KINDS as readonly string[]).includes(kind)) {
    errors.push("canonicalUnitKind must be mass|volume|count");
  }
  if (kind === "volume" && !isPosNumber(r.density)) {
    errors.push("volume-kind requires a positive density");
  }
  if (kind === "count" && !isPosNumber(r.avgUnitGrams)) {
    errors.push("count-kind requires a positive avgUnitGrams");
  }

  const restock = r.restockQuantity as Record<string, unknown> | undefined;
  if (!restock || !isPosNumber(restock.quantity) || typeof restock.unit !== "string") {
    errors.push("restockQuantity must have a positive quantity and a unit string");
  }

  const category = r.category;
  if (typeof category !== "string" || !(CATEGORIES as string[]).includes(category)) {
    errors.push("category must be one of the known categories");
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      canonicalUnitKind: kind as StockMetadata["canonicalUnitKind"],
      density: typeof r.density === "number" ? r.density : undefined,
      avgUnitGrams: typeof r.avgUnitGrams === "number" ? r.avgUnitGrams : undefined,
      restockQuantity: {
        quantity: (restock as { quantity: number }).quantity,
        unit: (restock as { unit: string }).unit,
      },
      category: category as IngredientCategory,
    },
  };
}
```

Note: `restockQuantity.unit` may legitimately be an empty string for count items (e.g. "12 eggs"), so we only require it to be a string, not non-empty.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/lib/enrichment/validate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/enrichment/validate.ts src/lib/enrichment/validate.test.ts
git commit -m "feat(2a): validate enrichment results before write"
```

---

## Task 5: Prompt builder + JSON schema + Anthropic client wrapper

**Files:**
- Modify: `package.json` (add `@anthropic-ai/sdk`)
- Create: `src/lib/enrichment/prompt.ts`
- Test: `src/lib/enrichment/prompt.test.ts`
- Create: `src/lib/enrichment/client.ts`

- [ ] **Step 0: Confirm the dep + current SDK usage**

Raise with the owner: this installs `@anthropic-ai/sdk`. On approval:

Run: `npm install @anthropic-ai/sdk`

Then **use the `claude-api` skill (and context7 for `@anthropic-ai/sdk`)** to confirm the *current* syntax for: (a) prompt caching via `cache_control` on a system block, (b) structured outputs / forced-tool JSON output, and (c) model ids `claude-haiku-4-5` and `claude-sonnet-4-6`. The code in Step 3 below is the intended shape — reconcile it with what the skill reports before finalizing `client.ts`.

- [ ] **Step 1: Write the failing test (prompt builder only — pure)**

`src/lib/enrichment/prompt.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildSystemRules, buildUserPrompt, ENRICHMENT_TOOL } from "@/lib/enrichment/prompt";

describe("buildSystemRules", () => {
  const rules = buildSystemRules();

  it("documents the three unit kinds", () => {
    expect(rules).toMatch(/mass/);
    expect(rules).toMatch(/volume/);
    expect(rules).toMatch(/count/);
  });

  it("seeds known ground-truth examples from the macros lib", () => {
    // flour density and egg weight come from units.ts; including them keeps the
    // model consistent with the heuristic fallback.
    expect(rules).toMatch(/flour/);
    expect(rules).toMatch(/0\.53/);
    expect(rules).toMatch(/egg/);
  });

  it("explains nonfood exclusion", () => {
    expect(rules.toLowerCase()).toMatch(/nonfood/);
  });
});

describe("buildUserPrompt", () => {
  it("lists each ingredient name", () => {
    const prompt = buildUserPrompt(["egg", "olive oil"]);
    expect(prompt).toMatch(/egg/);
    expect(prompt).toMatch(/olive oil/);
  });
});

describe("ENRICHMENT_TOOL", () => {
  it("describes a per-ingredient array result", () => {
    expect(ENRICHMENT_TOOL.input_schema.type).toBe("object");
    // top-level "items" array, each with name + the metadata fields
    const items = ENRICHMENT_TOOL.input_schema.properties.items;
    expect(items.type).toBe("array");
    expect(items.items.properties.canonicalUnitKind.enum).toEqual(["mass", "volume", "count"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/enrichment/prompt.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the prompt module**

`src/lib/enrichment/prompt.ts`:

```ts
/**
 * Cached system rules + the structured-output tool schema for ingredient
 * enrichment. Kept pure (no SDK import) so it is unit-tested in isolation.
 */

const KIND_ENUM = ["mass", "volume", "count"] as const;
const CATEGORY_ENUM = [
  "produce", "protein", "dairy", "pantry", "spice", "other", "nonfood",
] as const;

/** The cached system block: classification rules + ground-truth examples. */
export function buildSystemRules(): string {
  return [
    "You assign kitchen stock metadata to grocery ingredients for a recipe app.",
    "For each ingredient choose:",
    "- canonicalUnitKind: 'mass' for things bought/measured by weight (ground beef, flour by weight),",
    "  'volume' for liquids and things measured by volume (milk, oil, soy sauce),",
    "  'count' for whole items (eggs, lemons, garlic cloves).",
    "- density (g/ml): ONLY for volume-kind. Examples: water 1.0, flour 0.53, sugar 0.85,",
    "  oil 0.92, honey 1.42, milk 1.03. Match these where applicable.",
    "- avgUnitGrams: ONLY for count-kind. Examples: egg 50, garlic clove 5, onion 110,",
    "  lemon 60, tomato 120.",
    "- restockQuantity { quantity, unit }: ONE typical grocery purchase. Examples:",
    "  eggs -> { quantity: 12, unit: '' }, flour -> { quantity: 5, unit: 'lb' },",
    "  milk -> { quantity: 1, unit: 'l' }. Use '' for unit on pure counts.",
    `- category: one of ${CATEGORY_ENUM.join(", ")}. Use 'nonfood' for paper towels,`,
    "  foil, dish soap, etc. Non-food items are excluded from the cookable filter.",
    "Be consistent with the example values above.",
  ].join("\n");
}

export function buildUserPrompt(names: string[]): string {
  return [
    "Assign stock metadata to these ingredients. Return one entry per name:",
    ...names.map((n) => `- ${n}`),
  ].join("\n");
}

/** Forced-tool schema = the structured output we require back. */
export const ENRICHMENT_TOOL = {
  name: "assign_stock_metadata",
  description: "Return stock metadata for each ingredient name.",
  input_schema: {
    type: "object" as const,
    properties: {
      items: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            name: { type: "string" as const },
            canonicalUnitKind: { type: "string" as const, enum: [...KIND_ENUM] },
            density: { type: "number" as const },
            avgUnitGrams: { type: "number" as const },
            restockQuantity: {
              type: "object" as const,
              properties: {
                quantity: { type: "number" as const },
                unit: { type: "string" as const },
              },
              required: ["quantity", "unit"],
            },
            category: { type: "string" as const, enum: [...CATEGORY_ENUM] },
          },
          required: ["name", "canonicalUnitKind", "restockQuantity", "category"],
        },
      },
    },
    required: ["items"],
  },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/lib/enrichment/prompt.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the client wrapper (I/O glue — no unit test)**

`src/lib/enrichment/client.ts`. This is the only file whose exact API calls must be reconciled with the `claude-api` skill / context7 (Step 0). Intended shape:

```ts
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemRules, buildUserPrompt, ENRICHMENT_TOOL } from "@/lib/enrichment/prompt";

export type RawEnrichmentItem = { name: string } & Record<string, unknown>;

const HAIKU = "claude-haiku-4-5";
const SONNET = "claude-sonnet-4-6";

/**
 * Call Claude once for a batch of names. Returns the raw `items` array (caller
 * validates each). System rules are sent with cache_control so repeat batches
 * reuse the cached prefix. Falls back to Sonnet if Haiku output is unusable.
 */
export async function enrichBatch(
  names: string[],
  opts: { model?: string } = {},
): Promise<RawEnrichmentItem[]> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  const model = opts.model ?? HAIKU;

  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    system: [
      { type: "text", text: buildSystemRules(), cache_control: { type: "ephemeral" } },
    ],
    tools: [ENRICHMENT_TOOL],
    tool_choice: { type: "tool", name: ENRICHMENT_TOOL.name },
    messages: [{ role: "user", content: buildUserPrompt(names) }],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    if (model === HAIKU) return enrichBatch(names, { model: SONNET });
    throw new Error("Enrichment: no tool_use block in response");
  }
  const input = toolUse.input as { items?: RawEnrichmentItem[] };
  return input.items ?? [];
}

export { HAIKU, SONNET };
```

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc --noEmit` (expect no new errors from these files), then:

```bash
git add package.json package-lock.json src/lib/enrichment/prompt.ts src/lib/enrichment/prompt.test.ts src/lib/enrichment/client.ts
git commit -m "feat(2a): enrichment prompt schema + Anthropic client wrapper"
```

---

## Task 6: The run-once enrichment script

**Files:**
- Modify: `package.json` (add `tsx` dev dep + `enrich:ingredients` script)
- Create: `scripts/enrich-ingredients.ts`

This is committed, idempotent glue (no unit test — it is pure I/O orchestration over already-tested logic). It supports `--force` (re-enrich all) and `--dry` (print planned writes, no Sanity write).

- [ ] **Step 1: Add the dev dep + npm script**

Raise the `tsx` dev dep with the owner, then:

Run: `npm install -D tsx`

Add to `package.json` `scripts`:

```json
    "enrich:ingredients": "node --import tsx --env-file=.env.local scripts/enrich-ingredients.ts"
```

- [ ] **Step 2: Write the script**

`scripts/enrich-ingredients.ts`:

```ts
/**
 * One-time admin pass: assign stock metadata (canonicalUnitKind, density /
 * avgUnitGrams, restockQuantity, category) to every catalog ingredient that
 * lacks it, using Claude with a heuristic fallback. Idempotent.
 *
 *   npm run enrich:ingredients            # enrich only ingredients missing data
 *   npm run enrich:ingredients -- --force # re-enrich everything
 *   npm run enrich:ingredients -- --dry   # print planned writes, write nothing
 *
 * Requires ANTHROPIC_API_KEY and SANITY_API_WRITE_TOKEN in .env.local.
 */
import { client } from "@/sanity/lib/client";
import { getWriteClient } from "@/sanity/lib/write-client";
import { selectIngredientsNeedingEnrichment } from "@/lib/enrichment/select";
import { enrichBatch } from "@/lib/enrichment/client";
import { validateEnrichmentResult } from "@/lib/enrichment/validate";
import { mergeWithFallback } from "@/lib/enrichment/fallback";
import type { IngredientDoc } from "@/lib/enrichment/types";

const BATCH = 25;

async function main() {
  const force = process.argv.includes("--force");
  const dry = process.argv.includes("--dry");

  const docs = await client.fetch<IngredientDoc[]>(
    `*[_type == "ingredient"]{ _id, name, category, canonicalUnitKind, density, avgUnitGrams, restockQuantity }`,
  );
  const todo = selectIngredientsNeedingEnrichment(docs, { force });
  console.log(`Catalog: ${docs.length} ingredients, ${todo.length} need enrichment.`);
  if (todo.length === 0) return;

  const write = getWriteClient();
  let written = 0;
  const skipped: string[] = [];

  for (let i = 0; i < todo.length; i += BATCH) {
    const slice = todo.slice(i, i + BATCH);
    const byName = new Map(slice.map((d) => [d.name.toLowerCase(), d]));
    const items = await enrichBatch(slice.map((d) => d.name));

    for (const raw of items) {
      const doc = byName.get(String(raw.name).toLowerCase());
      if (!doc) continue;
      const merged = mergeWithFallback(raw, doc.name);
      const result = validateEnrichmentResult(merged);
      if (!result.ok) {
        skipped.push(`${doc.name}: ${result.errors.join("; ")}`);
        continue;
      }
      const m = result.value;
      if (dry) {
        console.log(`DRY ${doc.name} ->`, JSON.stringify(m));
        continue;
      }
      await write
        .patch(doc._id)
        .set({
          canonicalUnitKind: m.canonicalUnitKind,
          ...(m.density != null ? { density: m.density } : {}),
          ...(m.avgUnitGrams != null ? { avgUnitGrams: m.avgUnitGrams } : {}),
          restockQuantity: m.restockQuantity,
          category: m.category,
        })
        .commit();
      written++;
    }
  }

  console.log(`Done. Wrote ${written}; skipped ${skipped.length}.`);
  if (skipped.length) console.log("Needs manual review in Studio:\n" + skipped.join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 3: Verify it compiles (no run yet — needs the API key)**

Run: `npx tsc --noEmit`
Expected: no new errors. (Do not run the script until Task 7.)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json scripts/enrich-ingredients.ts
git commit -m "feat(2a): run-once ingredient enrichment script (idempotent, --force/--dry)"
```

---

## Task 7: Run the enrichment + verify (owner-gated)

**Files:** none (operational).

- [ ] **Step 1: Owner sets `ANTHROPIC_API_KEY`**

The agent cannot write `.env*`. Owner adds `ANTHROPIC_API_KEY=...` to `.env.local` (and `SANITY_API_WRITE_TOKEN` if not already present).

- [ ] **Step 2: Dry run first**

Run: `npm run enrich:ingredients -- --dry`
Expected: a printed plan, one line per ingredient, no writes. Eyeball a handful for sanity (eggs count/12, flour volume/0.53, paper towels → nonfood).

- [ ] **Step 3: Real run**

Run: `npm run enrich:ingredients`
Expected: `Wrote N; skipped M` summary; any skips listed for manual Studio review.

- [ ] **Step 4: Review in Sanity Studio**

Open the ingredient list, spot-check categories + restock quantities, correct anything off, and hand-fill any `skipped` ingredients.

- [ ] **Step 5: Full gate + commit**

Run: `npm test` then `npm run lint` then `npx tsc --noEmit`. Report results.
(No code commit needed unless review surfaced edits.)

- [ ] **Step 6: `/code-review` the 2a commits and address findings**

Then return for the **Spec 2b** plan.

---

## Self-Review (completed by plan author)

- **Spec coverage (§5 of the design):** schema fields (Task 1), Claude enrichment with structured output + prompt caching + Haiku-default/Sonnet-fallback (Tasks 5–6), idempotency + `--force` (Tasks 2, 6), fallback consistency with `units.ts` (Task 3), owner-run not in user flow (Task 7), `ANTHROPIC_API_KEY` dependency flagged (header + Task 7). ✓
- **Testing coverage (§5 testing line):** structured-output schema conformance (Task 5 `ENRICHMENT_TOOL` + Task 4 `validate`), idempotency/skip-already-enriched (Task 2), fallback seeding consistency (Task 3). ✓
- **Placeholders:** none — pure-logic tasks carry full code + tests; the only "confirm live" note is the Anthropic SDK call in `client.ts`, deliberately reconciled against the `claude-api` skill per the user's working agreement (confirm API usage via context7, not memory). The shape is fully specified.
- **Type consistency:** `StockMetadata`, `IngredientDoc`, `CanonicalUnitKind`, `RestockQuantity` defined in Task 2 and used consistently in Tasks 3–6; `validateEnrichmentResult` return shape feeds the script's `.set()` in Task 6; `enrichBatch`/`ENRICHMENT_TOOL.name` names match between Task 5 and Task 6.
