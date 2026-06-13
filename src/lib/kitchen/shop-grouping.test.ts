import { describe, it, expect } from "vitest";
import {
  buildShopItems,
  groupShopItems,
  shopItemMetaLabel,
} from "@/lib/kitchen/shop-grouping";

const NEEDS = [
  { ingredientId: "beef", name: "beef", amount: 450, optional: false, category: "protein", canonicalUnitKind: "mass" as const, buyQuantityG: 500 },
  { ingredientId: "milk", name: "milk", amount: 500, optional: false, category: "dairy", canonicalUnitKind: "volume" as const, buyQuantityG: 946 },
  { ingredientId: "parsley", name: "parsley", amount: 10, optional: true, category: "produce", canonicalUnitKind: "mass" as const, buyQuantityG: null },
];
const MANUAL = [
  { ingredientId: "napkins", source: "manual" as const, manualQuantity: { quantity: 1, unit: "pack" }, name: "napkins", canonicalUnitKind: null, category: "nonfood", buyQuantityG: null },
  { ingredientId: "apple", source: "manual" as const, manualQuantity: null, name: "apple", canonicalUnitKind: "count" as const, category: "produce", buyQuantityG: null },
];

describe("buildShopItems", () => {
  it("unifies needs and manual into one list tagged by source", () => {
    const items = buildShopItems(NEEDS, MANUAL);
    expect(items).toHaveLength(5);
    expect(items.find((i) => i.ingredientId === "beef")?.source).toBe("need");
    expect(items.find((i) => i.ingredientId === "napkins")?.source).toBe("manual");
  });
});

describe("groupShopItems", () => {
  it("orders groups by store category with the optional group pinned last", () => {
    const groups = groupShopItems(buildShopItems(NEEDS, MANUAL));
    const keys = groups.map((g) => g.key);
    // produce(apple) → dairy(milk) → protein(beef) → nonfood(napkins) → optional(parsley)
    expect(keys).toEqual(["produce", "dairy", "protein", "nonfood", "optional"]);
    expect(groups.at(-1)?.key).toBe("optional");
    expect(groups.at(-1)?.items.map((i) => i.ingredientId)).toEqual(["parsley"]);
  });

  it("puts unknown/other categories into the 'other' group", () => {
    const items = buildShopItems(
      [{ ingredientId: "x", name: "mystery", amount: 1, optional: false, category: null, canonicalUnitKind: null, buyQuantityG: null }],
      [],
    );
    expect(groupShopItems(items)[0].key).toBe("other");
  });

  it("sorts items alphabetically within a group", () => {
    const items = buildShopItems(
      [
        { ingredientId: "b", name: "banana", amount: 1, optional: false, category: "produce", canonicalUnitKind: "count", buyQuantityG: null },
        { ingredientId: "a", name: "apple", amount: 1, optional: false, category: "produce", canonicalUnitKind: "count", buyQuantityG: null },
      ],
      [],
    );
    expect(groupShopItems(items)[0].items.map((i) => i.name)).toEqual(["apple", "banana"]);
  });
});

describe("shopItemMetaLabel", () => {
  it("shows buying and needs for a need item", () => {
    const item = {
      ingredientId: "i", name: "cream", category: "dairy", optional: false,
      source: "need" as const, amount: 240, canonicalUnitKind: "mass" as const,
      manualQuantity: null, buyQuantityG: 473,
    };
    expect(shopItemMetaLabel(item)).toBe("buying 473 g · needs 240 g");
  });
  it("shows only buying for a manual item with a resolved quantity", () => {
    const item = {
      ingredientId: "i", name: "eggs", category: "dairy", optional: false,
      source: "manual" as const, amount: null, canonicalUnitKind: "count" as const,
      manualQuantity: { quantity: 12, unit: "" }, buyQuantityG: 12,
    };
    expect(shopItemMetaLabel(item)).toBe("buying 12");
  });
  it("falls back to the raw manual quantity text when unresolved", () => {
    const item = {
      ingredientId: "i", name: "napkins", category: "nonfood", optional: false,
      source: "manual" as const, amount: null, canonicalUnitKind: null,
      manualQuantity: { quantity: 1, unit: "pack" }, buyQuantityG: null,
    };
    expect(shopItemMetaLabel(item)).toBe("1 pack");
  });
  it("is empty when nothing is known", () => {
    const item = {
      ingredientId: "i", name: "x", category: null, optional: false,
      source: "manual" as const, amount: null, canonicalUnitKind: null,
      manualQuantity: null, buyQuantityG: null,
    };
    expect(shopItemMetaLabel(item)).toBe("");
  });
});
