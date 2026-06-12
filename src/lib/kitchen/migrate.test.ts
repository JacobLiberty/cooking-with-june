import { describe, it, expect } from "vitest";
import { planSeed, pantrySeed, resolveManualItems } from "@/lib/kitchen/migrate";
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

describe("resolveManualItems", () => {
  const catalog = [
    { ingredientId: "i1", name: "Tomato" },
    { ingredientId: "i2", name: "Orange" },
    { ingredientId: "i3", name: "havarti" },
  ];

  it("matches case-insensitively and via simple plurals, carrying location", () => {
    const res = resolveManualItems(
      [
        { name: "tomatoes", location: "pantry" },
        { name: "Oranges", location: "pantry" },
        { name: "HAVARTI", location: "grocery" },
        { name: "bagels", location: "pantry" },
      ],
      catalog,
    );
    expect(res).toEqual([
      { sourceName: "tomatoes", location: "pantry", ingredientId: "i1", catalogName: "Tomato" },
      { sourceName: "Oranges", location: "pantry", ingredientId: "i2", catalogName: "Orange" },
      { sourceName: "HAVARTI", location: "grocery", ingredientId: "i3", catalogName: "havarti" },
      { sourceName: "bagels", location: "pantry", ingredientId: null, catalogName: null },
    ]);
  });

  it("defaults a missing location to grocery", () => {
    const res = resolveManualItems([{ name: "havarti" }], catalog);
    expect(res[0].location).toBe("grocery");
  });
});
