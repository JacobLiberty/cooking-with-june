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
