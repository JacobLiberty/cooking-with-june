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
    expect(recipeCoverage(reqs, pantry)).toEqual({ cookable: true, missingRequired: 0, missing: [] });
  });

  it("counts each short required ingredient as missing", () => {
    const reqs = [req("beef", 200), req("rice", 100)];
    const pantry = new Map([["beef", 50]]);
    expect(recipeCoverage(reqs, pantry)).toEqual({ cookable: false, missingRequired: 2, missing: [{ ingredientId: "beef", name: "beef" }, { ingredientId: "rice", name: "rice" }] });
  });

  it("ignores optional ingredients", () => {
    const reqs = [req("beef", 200), req("herbs", 10, { optional: true })];
    const pantry = new Map([["beef", 200]]);
    expect(recipeCoverage(reqs, pantry)).toEqual({ cookable: true, missingRequired: 0, missing: [] });
  });

  it("ignores nonfood ingredients", () => {
    const reqs = [req("beef", 200), req("foil", 1, { category: "nonfood" })];
    const pantry = new Map([["beef", 200]]);
    expect(recipeCoverage(reqs, pantry)).toEqual({ cookable: true, missingRequired: 0, missing: [] });
  });

  it("sums duplicate lines for the same ingredient before comparing", () => {
    const reqs = [req("milk", 100), req("milk", 100)];
    const pantry = new Map([["milk", 150]]);
    expect(recipeCoverage(reqs, pantry)).toEqual({ cookable: false, missingRequired: 1, missing: [{ ingredientId: "milk", name: "milk" }] });
  });

  it("is not cookable when there are no required non-nonfood ingredients", () => {
    const reqs = [req("herbs", 10, { optional: true })];
    expect(recipeCoverage(reqs, new Map())).toEqual({ cookable: false, missingRequired: 0, missing: [] });
  });

  it("lists the missing required ingredients by id and name", () => {
    const reqs = [
      { ingredientId: "a", name: "apples", amount: 3, optional: false, category: "produce" as const },
      { ingredientId: "b", name: "butter", amount: 50, optional: false, category: "dairy" as const },
      { ingredientId: "c", name: "chives", amount: 5, optional: true, category: "produce" as const },
    ];
    const cov = recipeCoverage(reqs, new Map([["a", 3]]));
    expect(cov.cookable).toBe(false);
    expect(cov.missingRequired).toBe(1);
    expect(cov.missing).toEqual([{ ingredientId: "b", name: "butter" }]);
  });

  it("returns an empty missing list when cookable", () => {
    const reqs = [
      { ingredientId: "a", name: "apples", amount: 3, optional: false, category: "produce" as const },
    ];
    expect(recipeCoverage(reqs, new Map([["a", 5]])).missing).toEqual([]);
  });
});
