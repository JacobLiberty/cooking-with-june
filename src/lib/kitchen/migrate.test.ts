import { describe, it, expect } from "vitest";
import { planSeed, pantrySeed, matchManualItems } from "@/lib/kitchen/migrate";
import type { RawLine } from "@/lib/kitchen/assemble";

describe("planSeed", () => {
  it("pairs each recipe id with its scale, defaulting to 1", () => {
    const seed = planSeed(["r1", "r2"], [{ recipeId: "r1", scale: 3 }]);
    expect(seed).toEqual([
      { recipeId: "r1", scale: 3 },
      { recipeId: "r2", scale: 1 },
    ]);
  });

  it("handles missing/empty inputs", () => {
    expect(planSeed(null, null)).toEqual([]);
  });
});

const beef: RawLine = {
  ingredientId: "beef", name: "ground beef", canonicalUnitKind: "mass",
  density: null, avgUnitGrams: null, category: "protein",
  restockQuantity: { quantity: 1, unit: "kg" },
};
const egg: RawLine = {
  ingredientId: "egg", name: "egg", canonicalUnitKind: "count",
  density: null, avgUnitGrams: 50, category: "produce",
  restockQuantity: { quantity: 12, unit: "" },
};
const unenriched: RawLine = {
  ingredientId: "mystery", name: "unobtainium", canonicalUnitKind: null,
  density: null, avgUnitGrams: null, category: null, restockQuantity: null,
};
const noRestock: RawLine = {
  ingredientId: "salt", name: "salt", canonicalUnitKind: "mass",
  density: null, avgUnitGrams: null, category: "spice", restockQuantity: null,
};

describe("pantrySeed", () => {
  it("seeds each pantry ingredient at its restock default in canonical units", () => {
    const { seed, skipped } = pantrySeed([beef, egg]);
    expect(seed).toEqual([
      { ingredientId: "beef", name: "ground beef", quantityG: 1000, canonicalUnitKind: "mass" },
      { ingredientId: "egg", name: "egg", quantityG: 12, canonicalUnitKind: "count" },
    ]);
    expect(skipped).toEqual([]);
  });

  it("reports un-enriched and no-restock ingredients as skipped, not seeded", () => {
    const { seed, skipped } = pantrySeed([unenriched, noRestock]);
    expect(seed).toEqual([]);
    expect(skipped.map((s) => s.ingredientId)).toEqual(["mystery", "salt"]);
    expect(skipped[0].reason).toMatch(/metadata/i);
    expect(skipped[1].reason).toMatch(/restock/i);
  });
});

describe("matchManualItems", () => {
  it("matches free-text names to the catalog case-insensitively", () => {
    const catalog = [
      { ingredientId: "i1", name: "Paper Towels" },
      { ingredientId: "i2", name: "Olive Oil" },
    ];
    const { matched, unmapped } = matchManualItems(
      [{ name: "paper towels" }, { name: "grandma's sauce" }],
      catalog,
    );
    expect(matched).toEqual([{ name: "paper towels", ingredientId: "i1" }]);
    expect(unmapped).toEqual(["grandma's sauce"]);
  });
});
