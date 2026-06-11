# Spec 2b — Pure conversion + kitchen-loop logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, fully-unit-tested math for Spec 2's kitchen loop — gram/canonical conversion (stored-metadata-preferred, heuristic fallback), plan-derived grocery needs, cookable/missing computation, and depletion deltas — in a new `src/lib/kitchen/` module, with no Convex or Sanity dependency.

**Architecture:** All logic is pure functions over plain data. Conversion reduces a recipe ingredient line to the ingredient's **canonical unit** (grams for mass/volume-kind, item **count** for count-kind), preferring the per-ingredient stock metadata from Spec 2a and falling back to the existing `src/lib/macros/units.ts` heuristics. Higher-level functions (requirements → needs / cookable / depletion) operate entirely in canonical units so amounts are directly summable and comparable. Spec 2c will feed these functions Sanity recipe data + Convex pantry state; Spec 2b is consumer-agnostic.

**Tech Stack:** TypeScript, Vitest (`tsconfigPaths` resolves `@/`). Reuses `src/lib/scale.ts` (`parseQuantityValue`) and `src/lib/macros/units.ts` (`MASS_G`, `VOLUME_ML`, `COUNT_UNITS`, `normalizeUnit`, `densityFor`, `countWeightFor`). Reuses `CanonicalUnitKind` / `IngredientCategory` from `src/lib/enrichment/types.ts`.

**Parent spec:** [docs/superpowers/specs/2026-06-11-cooking-with-june-spec-2-pantry-design.md](../specs/2026-06-11-cooking-with-june-spec-2-pantry-design.md) §6.

**Key canonical-unit rule (locked in the spec):** pantry quantity for an ingredient is stored in its canonical unit — **grams** for `mass`/`volume`-kind, an item **count** for `count`-kind. Every function in this module that produces or consumes an "amount" uses that same canonical unit per ingredient, so amounts add and compare directly.

---

## File Structure

- `src/lib/kitchen/types.ts` — **create**: `ConversionMeta`, `IngredientInfo`, `RecipeLine`, `IngredientRequirement`, `GroceryNeed`, result types.
- `src/lib/kitchen/convert.ts` + `convert.test.ts` — **create**: `lineToGrams`, `lineToCanonical`.
- `src/lib/kitchen/requirements.ts` + `requirements.test.ts` — **create**: `recipeRequirements`.
- `src/lib/kitchen/need.ts` + `need.test.ts` — **create**: `computeNeeds`.
- `src/lib/kitchen/cookable.ts` + `cookable.test.ts` — **create**: `recipeCoverage`.
- `src/lib/kitchen/deplete.ts` + `deplete.test.ts` — **create**: `depletionDeltas`.

Each file has one responsibility. `types.ts` is shared; the four higher-level files each import `convert`/`types` only.

---

## Task 1: Conversion types + `lineToGrams`

**Files:**
- Create: `src/lib/kitchen/types.ts`
- Create: `src/lib/kitchen/convert.ts`
- Test: `src/lib/kitchen/convert.test.ts`

- [ ] **Step 1: Create the shared types**

`src/lib/kitchen/types.ts`:

```ts
import type { CanonicalUnitKind, IngredientCategory } from "@/lib/enrichment/types";

/** The conversion-relevant subset of an ingredient's stock metadata. */
export type ConversionMeta = {
  canonicalUnitKind: CanonicalUnitKind;
  density?: number; // g/ml, meaningful for volume-kind
  avgUnitGrams?: number; // g/item, meaningful for count-kind
};

/** Conversion metadata plus the category (needed for the cookable filter). */
export type IngredientInfo = ConversionMeta & { category: IngredientCategory };

/** A recipe ingredient line, as much as the kitchen math needs. */
export type RecipeLine = {
  ingredientId: string;
  name: string;
  quantity?: string | null;
  unit?: string | null;
  optional?: boolean;
};

/** One ingredient's resolved, scaled requirement for a recipe, in canonical units. */
export type IngredientRequirement = {
  ingredientId: string;
  name: string;
  amount: number; // canonical unit (grams or count), already scaled
  optional: boolean;
  category: IngredientCategory;
};

/** A recipe line that could not be converted (missing amount, unknown unit, no metadata). */
export type UnparsedLine = {
  ingredientId: string;
  name: string;
  reason: string;
};

/** One computed grocery need (canonical amount still owed after pantry). */
export type GroceryNeed = {
  ingredientId: string;
  name: string;
  amount: number; // canonical unit, > 0
  optional: boolean; // true only when every planned use is optional
};

export type GramsResult = { grams: number } | { unparseable: true; reason: string };
```

- [ ] **Step 2: Write the failing test**

`src/lib/kitchen/convert.test.ts` (this task tests `lineToGrams` only; `lineToCanonical` is Task 2 — do not import it yet):

```ts
import { describe, it, expect } from "vitest";
import { lineToGrams } from "@/lib/kitchen/convert";
import type { ConversionMeta } from "@/lib/kitchen/types";

const mass: ConversionMeta = { canonicalUnitKind: "mass" };
const volumeWithDensity: ConversionMeta = { canonicalUnitKind: "volume", density: 0.5 };
const countWithWeight: ConversionMeta = { canonicalUnitKind: "count", avgUnitGrams: 40 };

describe("lineToGrams", () => {
  it("mass units are exact and ignore metadata", () => {
    expect(lineToGrams("2", "lb", mass, "flour")).toEqual({ grams: 2 * 453.6 });
  });

  it("volume uses stored density over the name heuristic", () => {
    // 1 cup = 240 ml; stored density 0.5 -> 120 g (heuristic for "mystery" would be 1.0)
    expect(lineToGrams("1", "cup", volumeWithDensity, "mystery goo")).toEqual({ grams: 120 });
  });

  it("volume falls back to the name heuristic when no stored density", () => {
    // flour heuristic density = 0.53; 1 cup = 240 ml -> 127.2 g
    const r = lineToGrams("1", "cup", { canonicalUnitKind: "volume" }, "flour");
    expect(r).toEqual({ grams: 240 * 0.53 });
  });

  it("count uses stored avgUnitGrams over the heuristic", () => {
    // 3 items * 40 g (stored) = 120 g (egg heuristic would be 50)
    expect(lineToGrams("3", "", countWithWeight, "egg")).toEqual({ grams: 120 });
  });

  it("count falls back to the name heuristic when no stored weight", () => {
    // egg heuristic = 50 g; "2 eggs" -> 100 g
    expect(lineToGrams("2", "", { canonicalUnitKind: "count" }, "egg")).toEqual({ grams: 100 });
  });

  it("reports unparseable when there is no numeric quantity", () => {
    const r = lineToGrams("a pinch", "", mass, "salt");
    expect("unparseable" in r && r.unparseable).toBe(true);
  });

  it("reports unparseable for a count with no known item weight", () => {
    const r = lineToGrams("2", "", { canonicalUnitKind: "count" }, "dragonfruit");
    expect("unparseable" in r && r.unparseable).toBe(true);
  });

  it("reports unparseable for an unknown unit", () => {
    const r = lineToGrams("2", "smidgen", mass, "salt");
    expect("unparseable" in r && r.unparseable).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- src/lib/kitchen/convert.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `lineToGrams`**

`src/lib/kitchen/convert.ts`:

```ts
import { parseQuantityValue } from "@/lib/scale";
import {
  MASS_G,
  VOLUME_ML,
  COUNT_UNITS,
  normalizeUnit,
  densityFor,
  countWeightFor,
} from "@/lib/macros/units";
import type { ConversionMeta, GramsResult } from "@/lib/kitchen/types";

/**
 * Convert one ingredient line to grams, preferring the ingredient's stored
 * metadata (density / avgUnitGrams) over the name-substring heuristics.
 *
 * - Mass units are exact.
 * - Volume units use `meta.density`, else the name heuristic (default water).
 * - Count/unitless amounts use `meta.avgUnitGrams`, else the name heuristic.
 * Anything without a number, an unknown unit, or a count with no known weight is
 * reported unparseable so the caller can flag it.
 */
export function lineToGrams(
  quantity: string | undefined | null,
  unit: string | undefined | null,
  meta: ConversionMeta,
  name: string,
): GramsResult {
  const value = parseQuantityValue(quantity);
  if (value == null) return { unparseable: true, reason: "no numeric quantity" };
  if (value < 0) return { unparseable: true, reason: "negative quantity" };

  const u = normalizeUnit(unit);

  if (u in MASS_G) return { grams: value * MASS_G[u] };

  if (u in VOLUME_ML) {
    const density = meta.density ?? densityFor(name);
    return { grams: value * VOLUME_ML[u] * density };
  }

  if (COUNT_UNITS.has(u)) {
    const weight = meta.avgUnitGrams ?? countWeightFor(name, u);
    if (weight == null) {
      return { unparseable: true, reason: `no item weight for "${name}"` };
    }
    return { grams: value * weight };
  }

  return { unparseable: true, reason: `unknown unit "${unit ?? ""}"` };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- src/lib/kitchen/convert.test.ts`
Expected: PASS. Then `npx tsc --noEmit` (clean).

- [ ] **Step 6: Commit**

```bash
git add src/lib/kitchen/types.ts src/lib/kitchen/convert.ts src/lib/kitchen/convert.test.ts
git commit -m "feat(2b): kitchen types + lineToGrams (stored-pref, heuristic fallback)"
```

---

## Task 2: `lineToCanonical` (reduce to the ingredient's canonical unit)

**Files:**
- Modify: `src/lib/kitchen/convert.ts`
- Test: `src/lib/kitchen/convert.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `src/lib/kitchen/convert.test.ts`:

```ts
import { lineToCanonical } from "@/lib/kitchen/convert";

describe("lineToCanonical", () => {
  it("mass-kind returns grams unchanged", () => {
    const r = lineToCanonical("2", "lb", { canonicalUnitKind: "mass" }, "flour");
    expect(r).toEqual({ ok: true, amount: 2 * 453.6 });
  });

  it("volume-kind returns grams", () => {
    const r = lineToCanonical("1", "cup", { canonicalUnitKind: "volume", density: 1 }, "water");
    expect(r).toEqual({ ok: true, amount: 240 });
  });

  it("count-kind reduces grams to a count via avgUnitGrams (round trip)", () => {
    // "2 eggs" -> 100 g -> /50 -> 2
    const r = lineToCanonical("2", "", { canonicalUnitKind: "count", avgUnitGrams: 50 }, "egg");
    expect(r).toEqual({ ok: true, amount: 2 });
  });

  it("count-kind converts a weight line into a count", () => {
    // "100 g egg" with avgUnitGrams 50 -> 2 eggs
    const r = lineToCanonical("100", "g", { canonicalUnitKind: "count", avgUnitGrams: 50 }, "egg");
    expect(r).toEqual({ ok: true, amount: 2 });
  });

  it("count-kind falls back to the name heuristic weight when metadata lacks it", () => {
    // no avgUnitGrams; egg heuristic = 50; "2 eggs" -> 2
    const r = lineToCanonical("2", "", { canonicalUnitKind: "count" }, "egg");
    expect(r).toEqual({ ok: true, amount: 2 });
  });

  it("count-kind is unparseable when no per-item weight is known anywhere", () => {
    const r = lineToCanonical("2", "", { canonicalUnitKind: "count" }, "dragonfruit");
    expect(r.ok).toBe(false);
  });

  it("propagates an unparseable grams result", () => {
    const r = lineToCanonical("a pinch", "", { canonicalUnitKind: "mass" }, "salt");
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify the new ones fail**

Run: `npm test -- src/lib/kitchen/convert.test.ts`
Expected: FAIL — `lineToCanonical` not exported.

- [ ] **Step 3: Implement `lineToCanonical`**

Add to `src/lib/kitchen/convert.ts` (add `countWeightFor` is already imported; add the `CanonicalResult` import):

Update the type import line to:
```ts
import type { ConversionMeta, GramsResult } from "@/lib/kitchen/types";
```
and add this export:

```ts
export type CanonicalResult =
  | { ok: true; amount: number }
  | { ok: false; reason: string };

/**
 * Convert a line to the ingredient's canonical unit: grams for mass/volume-kind,
 * item count for count-kind. Count conversion divides grams by the per-item
 * weight (stored `avgUnitGrams`, else the name heuristic).
 */
export function lineToCanonical(
  quantity: string | undefined | null,
  unit: string | undefined | null,
  meta: ConversionMeta,
  name: string,
): CanonicalResult {
  const g = lineToGrams(quantity, unit, meta, name);
  if ("unparseable" in g) return { ok: false, reason: g.reason };

  if (meta.canonicalUnitKind === "count") {
    const per = meta.avgUnitGrams ?? countWeightFor(name, "") ?? null;
    if (per == null || per <= 0) {
      return { ok: false, reason: `no per-item weight for "${name}"` };
    }
    return { ok: true, amount: g.grams / per };
  }

  return { ok: true, amount: g.grams };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/lib/kitchen/convert.test.ts`
Expected: PASS. Then `npx tsc --noEmit` (clean).

- [ ] **Step 5: Commit**

```bash
git add src/lib/kitchen/convert.ts src/lib/kitchen/convert.test.ts
git commit -m "feat(2b): lineToCanonical reduces to grams or count per kind"
```

---

## Task 3: `recipeRequirements` (resolve + scale a recipe's lines)

**Files:**
- Create: `src/lib/kitchen/requirements.ts`
- Test: `src/lib/kitchen/requirements.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/kitchen/requirements.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { recipeRequirements } from "@/lib/kitchen/requirements";
import type { RecipeLine, IngredientInfo } from "@/lib/kitchen/types";

const INFO: Record<string, IngredientInfo> = {
  beef: { canonicalUnitKind: "mass", category: "protein" },
  egg: { canonicalUnitKind: "count", avgUnitGrams: 50, category: "produce" },
  foil: { canonicalUnitKind: "count", avgUnitGrams: 1, category: "nonfood" },
};
const metaFor = (id: string) => INFO[id];

const lines: RecipeLine[] = [
  { ingredientId: "beef", name: "ground beef", quantity: "1", unit: "lb" },
  { ingredientId: "egg", name: "egg", quantity: "2", unit: "", optional: true },
  { ingredientId: "mystery", name: "unobtainium", quantity: "1", unit: "g" },
];

describe("recipeRequirements", () => {
  it("converts and scales each line to canonical units", () => {
    const { requirements } = recipeRequirements(lines, 2, metaFor);
    const beef = requirements.find((r) => r.ingredientId === "beef")!;
    expect(beef.amount).toBeCloseTo(2 * 453.6); // 1 lb * scale 2
    expect(beef.optional).toBe(false);
    expect(beef.category).toBe("protein");

    const egg = requirements.find((r) => r.ingredientId === "egg")!;
    expect(egg.amount).toBe(4); // 2 eggs * scale 2
    expect(egg.optional).toBe(true);
  });

  it("flags lines with no resolvable metadata as unparsed", () => {
    const { requirements, unparsed } = recipeRequirements(lines, 1, metaFor);
    expect(requirements.some((r) => r.ingredientId === "mystery")).toBe(false);
    expect(unparsed.map((u) => u.ingredientId)).toContain("mystery");
  });

  it("flags an unconvertible line (no quantity) as unparsed, not a requirement", () => {
    const { requirements, unparsed } = recipeRequirements(
      [{ ingredientId: "beef", name: "ground beef", quantity: "to taste", unit: "" }],
      1,
      metaFor,
    );
    expect(requirements).toHaveLength(0);
    expect(unparsed).toHaveLength(1);
  });

  it("scale defaults sensibly for non-positive scale", () => {
    const { requirements } = recipeRequirements(lines, 0, metaFor);
    const beef = requirements.find((r) => r.ingredientId === "beef")!;
    expect(beef.amount).toBeCloseTo(453.6); // scale clamped to 1
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/kitchen/requirements.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/kitchen/requirements.ts`:

```ts
import { lineToCanonical } from "@/lib/kitchen/convert";
import type {
  RecipeLine,
  IngredientInfo,
  IngredientRequirement,
  UnparsedLine,
} from "@/lib/kitchen/types";

export type RequirementsResult = {
  requirements: IngredientRequirement[];
  unparsed: UnparsedLine[];
};

/**
 * Resolve a recipe's ingredient lines to scaled, canonical-unit requirements.
 * A line with no metadata or an unconvertible amount is reported in `unparsed`
 * rather than silently dropped. `scale <= 0` is treated as 1.
 */
export function recipeRequirements(
  lines: RecipeLine[],
  scale: number,
  metaFor: (ingredientId: string) => IngredientInfo | undefined,
): RequirementsResult {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const requirements: IngredientRequirement[] = [];
  const unparsed: UnparsedLine[] = [];

  for (const line of lines) {
    const info = metaFor(line.ingredientId);
    if (!info) {
      unparsed.push({
        ingredientId: line.ingredientId,
        name: line.name,
        reason: "no stock metadata",
      });
      continue;
    }
    const r = lineToCanonical(line.quantity, line.unit, info, line.name);
    if (!r.ok) {
      unparsed.push({ ingredientId: line.ingredientId, name: line.name, reason: r.reason });
      continue;
    }
    requirements.push({
      ingredientId: line.ingredientId,
      name: line.name,
      amount: r.amount * s,
      optional: line.optional ?? false,
      category: info.category,
    });
  }

  return { requirements, unparsed };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/lib/kitchen/requirements.test.ts`
Expected: PASS. Then `npx tsc --noEmit` (clean).

- [ ] **Step 5: Commit**

```bash
git add src/lib/kitchen/requirements.ts src/lib/kitchen/requirements.test.ts
git commit -m "feat(2b): recipeRequirements resolves + scales lines to canonical units"
```

---

## Task 4: `computeNeeds` (grocery list math)

**Files:**
- Create: `src/lib/kitchen/need.ts`
- Test: `src/lib/kitchen/need.test.ts`

`computeNeeds` takes the **flattened** requirements across all planned recipes (each already scaled) plus the pantry, and returns one need per ingredient where the summed requirement exceeds the pantry. An ingredient is `optional` only when **every** requirement for it is optional (the spec's optional-grouping rule). Amounts are summed in canonical units (the spec's "smart-sum").

- [ ] **Step 1: Write the failing test**

`src/lib/kitchen/need.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeNeeds } from "@/lib/kitchen/need";
import type { IngredientRequirement } from "@/lib/kitchen/types";

const req = (
  ingredientId: string,
  amount: number,
  optional = false,
): IngredientRequirement => ({
  ingredientId,
  name: ingredientId,
  amount,
  optional,
  category: "pantry",
});

describe("computeNeeds", () => {
  it("sums requirements across recipes and subtracts pantry", () => {
    const reqs = [req("flour", 300), req("flour", 200)];
    const pantry = new Map([["flour", 100]]);
    const needs = computeNeeds(reqs, pantry);
    expect(needs).toEqual([
      { ingredientId: "flour", name: "flour", amount: 400, optional: false },
    ]);
  });

  it("omits ingredients fully covered by the pantry", () => {
    const needs = computeNeeds([req("salt", 50)], new Map([["salt", 80]]));
    expect(needs).toHaveLength(0);
  });

  it("marks an ingredient optional only when every use is optional", () => {
    const needs = computeNeeds(
      [req("herbs", 10, true), req("herbs", 5, true)],
      new Map(),
    );
    expect(needs[0].optional).toBe(true);
  });

  it("a single required use makes the ingredient required", () => {
    const needs = computeNeeds(
      [req("garlic", 10, true), req("garlic", 5, false)],
      new Map(),
    );
    expect(needs[0].optional).toBe(false);
    expect(needs[0].amount).toBe(15);
  });

  it("treats a missing pantry entry as zero on hand", () => {
    const needs = computeNeeds([req("rice", 200)], new Map());
    expect(needs[0].amount).toBe(200);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/kitchen/need.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/kitchen/need.ts`:

```ts
import type { IngredientRequirement, GroceryNeed } from "@/lib/kitchen/types";

/**
 * Compute grocery needs from the flattened (already scaled) requirements of all
 * planned recipes, minus what the pantry holds. One need per ingredient whose
 * summed requirement exceeds the pantry. An ingredient is `optional` only when
 * EVERY planned use of it is optional.
 */
export function computeNeeds(
  requirements: IngredientRequirement[],
  pantry: Map<string, number>,
): GroceryNeed[] {
  const sum = new Map<string, { name: string; amount: number; allOptional: boolean }>();

  for (const r of requirements) {
    const cur = sum.get(r.ingredientId);
    if (cur) {
      cur.amount += r.amount;
      cur.allOptional = cur.allOptional && r.optional;
    } else {
      sum.set(r.ingredientId, { name: r.name, amount: r.amount, allOptional: r.optional });
    }
  }

  const needs: GroceryNeed[] = [];
  for (const [ingredientId, { name, amount, allOptional }] of sum) {
    const need = amount - (pantry.get(ingredientId) ?? 0);
    if (need > 0) {
      needs.push({ ingredientId, name, amount: need, optional: allOptional });
    }
  }
  return needs;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/lib/kitchen/need.test.ts`
Expected: PASS. Then `npx tsc --noEmit` (clean).

- [ ] **Step 5: Commit**

```bash
git add src/lib/kitchen/need.ts src/lib/kitchen/need.test.ts
git commit -m "feat(2b): computeNeeds (smart-sum minus pantry, optional-grouping rule)"
```

---

## Task 5: `recipeCoverage` (cookable / missing-required)

**Files:**
- Create: `src/lib/kitchen/cookable.ts`
- Test: `src/lib/kitchen/cookable.test.ts`

`recipeCoverage` takes ONE recipe's requirements + the pantry and reports whether it is cookable now and how many required ingredients fall short. Only **required, non-nonfood** ingredients count. Duplicate ingredient lines within a recipe are summed. A recipe with no qualifying required ingredients is **not** cookable (matches the existing `filterCookable` behavior, which excludes zero-required recipes).

- [ ] **Step 1: Write the failing test**

`src/lib/kitchen/cookable.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { recipeCoverage } from "@/lib/kitchen/cookable";
import type { IngredientRequirement } from "@/lib/kitchen/types";

const req = (
  ingredientId: string,
  amount: number,
  opts: { optional?: boolean; category?: IngredientRequirement["category"] } = {},
): IngredientRequirement => ({
  ingredientId,
  name: ingredientId,
  amount,
  optional: opts.optional ?? false,
  category: opts.category ?? "pantry",
});

describe("recipeCoverage", () => {
  it("cookable when pantry covers every required ingredient", () => {
    const reqs = [req("beef", 200), req("rice", 100)];
    const pantry = new Map([["beef", 300], ["rice", 100]]);
    expect(recipeCoverage(reqs, pantry)).toEqual({ cookable: true, missingRequired: 0 });
  });

  it("counts each short required ingredient as missing", () => {
    const reqs = [req("beef", 200), req("rice", 100)];
    const pantry = new Map([["beef", 50]]);
    expect(recipeCoverage(reqs, pantry)).toEqual({ cookable: false, missingRequired: 2 });
  });

  it("ignores optional ingredients", () => {
    const reqs = [req("beef", 200), req("herbs", 10, { optional: true })];
    const pantry = new Map([["beef", 200]]);
    expect(recipeCoverage(reqs, pantry)).toEqual({ cookable: true, missingRequired: 0 });
  });

  it("ignores nonfood ingredients", () => {
    const reqs = [req("beef", 200), req("foil", 1, { category: "nonfood" })];
    const pantry = new Map([["beef", 200]]); // no foil in pantry
    expect(recipeCoverage(reqs, pantry)).toEqual({ cookable: true, missingRequired: 0 });
  });

  it("sums duplicate lines for the same ingredient before comparing", () => {
    const reqs = [req("milk", 100), req("milk", 100)];
    const pantry = new Map([["milk", 150]]); // need 200, have 150 -> short
    expect(recipeCoverage(reqs, pantry)).toEqual({ cookable: false, missingRequired: 1 });
  });

  it("is not cookable when there are no required non-nonfood ingredients", () => {
    const reqs = [req("herbs", 10, { optional: true })];
    expect(recipeCoverage(reqs, new Map())).toEqual({ cookable: false, missingRequired: 0 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/kitchen/cookable.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/kitchen/cookable.ts`:

```ts
import type { IngredientRequirement } from "@/lib/kitchen/types";

export type Coverage = { cookable: boolean; missingRequired: number };

/**
 * Coverage of ONE recipe against the pantry. Only required, non-nonfood
 * ingredients count; duplicate lines for the same ingredient are summed.
 * `cookable` is true only when there is at least one qualifying required
 * ingredient and the pantry covers all of them.
 */
export function recipeCoverage(
  requirements: IngredientRequirement[],
  pantry: Map<string, number>,
): Coverage {
  const required = new Map<string, number>();
  for (const r of requirements) {
    if (r.optional || r.category === "nonfood") continue;
    required.set(r.ingredientId, (required.get(r.ingredientId) ?? 0) + r.amount);
  }

  if (required.size === 0) return { cookable: false, missingRequired: 0 };

  let missingRequired = 0;
  for (const [ingredientId, amount] of required) {
    if ((pantry.get(ingredientId) ?? 0) < amount) missingRequired++;
  }
  return { cookable: missingRequired === 0, missingRequired };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/lib/kitchen/cookable.test.ts`
Expected: PASS. Then `npx tsc --noEmit` (clean).

- [ ] **Step 5: Commit**

```bash
git add src/lib/kitchen/cookable.ts src/lib/kitchen/cookable.test.ts
git commit -m "feat(2b): recipeCoverage (cookable now / missing-required, nonfood excluded)"
```

---

## Task 6: `depletionDeltas` (cook → subtract from pantry)

**Files:**
- Create: `src/lib/kitchen/deplete.ts`
- Test: `src/lib/kitchen/deplete.test.ts`

`depletionDeltas` takes ONE recipe's requirements + the set of optional ingredient ids the cook says they used, and returns the canonical amount to subtract per ingredient: all required amounts, plus optional amounts only for used ids. Clamping against the actual pantry happens in Spec 2c at apply time, so this returns the raw consumed amount (summed across duplicate lines).

- [ ] **Step 1: Write the failing test**

`src/lib/kitchen/deplete.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { depletionDeltas } from "@/lib/kitchen/deplete";
import type { IngredientRequirement } from "@/lib/kitchen/types";

const req = (
  ingredientId: string,
  amount: number,
  optional = false,
): IngredientRequirement => ({
  ingredientId,
  name: ingredientId,
  amount,
  optional,
  category: "pantry",
});

describe("depletionDeltas", () => {
  it("subtracts every required ingredient", () => {
    const reqs = [req("beef", 200), req("rice", 100)];
    const deltas = depletionDeltas(reqs, new Set());
    expect(deltas.get("beef")).toBe(200);
    expect(deltas.get("rice")).toBe(100);
  });

  it("includes an optional ingredient only when it was used", () => {
    const reqs = [req("beef", 200), req("herbs", 10, true), req("cheese", 30, true)];
    const deltas = depletionDeltas(reqs, new Set(["herbs"]));
    expect(deltas.get("herbs")).toBe(10);
    expect(deltas.has("cheese")).toBe(false);
  });

  it("sums duplicate lines for the same ingredient", () => {
    const reqs = [req("milk", 100), req("milk", 50)];
    expect(depletionDeltas(reqs, new Set()).get("milk")).toBe(150);
  });

  it("returns an empty map for no requirements", () => {
    expect(depletionDeltas([], new Set()).size).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/kitchen/deplete.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/kitchen/deplete.ts`:

```ts
import type { IngredientRequirement } from "@/lib/kitchen/types";

/**
 * The canonical amount to subtract from the pantry per ingredient when a recipe
 * is cooked: all required amounts, plus optional amounts only for the ingredient
 * ids the cook confirms they used. Duplicate lines are summed. Clamping against
 * the actual pantry happens at apply time (Spec 2c).
 */
export function depletionDeltas(
  requirements: IngredientRequirement[],
  usedOptionalIds: Set<string>,
): Map<string, number> {
  const deltas = new Map<string, number>();
  for (const r of requirements) {
    if (r.optional && !usedOptionalIds.has(r.ingredientId)) continue;
    deltas.set(r.ingredientId, (deltas.get(r.ingredientId) ?? 0) + r.amount);
  }
  return deltas;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/lib/kitchen/deplete.test.ts`
Expected: PASS. Then run the whole kitchen suite + typecheck:
Run: `npm test -- src/lib/kitchen/` then `npx tsc --noEmit`
Expected: all PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/kitchen/deplete.ts src/lib/kitchen/deplete.test.ts
git commit -m "feat(2b): depletionDeltas (required + used-optional consumption)"
```

---

## Task 7: Full gate + `/code-review`

**Files:** none (verification).

- [ ] **Step 1: Run the full gate**

Run: `npm test` then `npm run lint` then `npx tsc --noEmit`. Report results — all green expected.

- [ ] **Step 2: `/code-review` the 2b commits and address findings**

Then return for the **Spec 2c** plan (Convex tables + mutations + the cookable rewire that consumes this module).

---

## Self-Review (completed by plan author)

- **Spec coverage (§6 of the design):** stored-pref/heuristic-fallback conversion (Tasks 1–2), canonical grams-or-count rule (Task 2), need = sum × scale − pantry with smart-sum (Tasks 3–4), optional-only-if-every-recipe rule (Task 4), cookable / missing-required with nonfood excluded (Task 5), depletion deltas required + selected optionals (Task 6). Scaling lives in `recipeRequirements` (Task 3). ✓
- **Testing coverage (§6 testing line):** stored-vs-heuristic conversion, count-kind handling + round-trips, smart-sum, optional rule, required-only missing count, deplete with/without optionals, nonfood exclusion, clamp behavior (clamp itself is 2c; 2b returns raw consumed amount and the tests assert the raw deltas). ✓
- **Placeholders:** none — every step has complete code + tests.
- **Type consistency:** `ConversionMeta`/`IngredientInfo`/`RecipeLine`/`IngredientRequirement`/`GroceryNeed`/`UnparsedLine`/`GramsResult` defined in Task 1's `types.ts`; `CanonicalResult` added in Task 2's `convert.ts`. `recipeRequirements` (Task 3) returns `IngredientRequirement[]` consumed unchanged by `computeNeeds` (Task 4), `recipeCoverage` (Task 5), and `depletionDeltas` (Task 6). `metaFor` returns `IngredientInfo | undefined` consistently. Function names match across tasks (`lineToGrams`, `lineToCanonical`, `recipeRequirements`, `computeNeeds`, `recipeCoverage`, `depletionDeltas`).
- **Note for 2c:** clamp-at-zero on apply, plan-derived needs are computed (not stored), and the `skip`/`manual` grocery rows merge with these computed needs — all live in Spec 2c, which consumes this pure layer.
