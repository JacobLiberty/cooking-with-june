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
