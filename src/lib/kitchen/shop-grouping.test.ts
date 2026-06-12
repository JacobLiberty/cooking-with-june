import { describe, it, expect } from "vitest";
import {
  buildShopItems,
  groupShopItems,
  shopItemAmountLabel,
  type ShopItem,
} from "@/lib/kitchen/shop-grouping";

const NEEDS = [
  { ingredientId: "beef", name: "beef", amount: 450, optional: false, category: "protein", canonicalUnitKind: "mass" as const },
  { ingredientId: "milk", name: "milk", amount: 500, optional: false, category: "dairy", canonicalUnitKind: "volume" as const },
  { ingredientId: "parsley", name: "parsley", amount: 10, optional: true, category: "produce", canonicalUnitKind: "mass" as const },
];
const MANUAL = [
  { ingredientId: "napkins", source: "manual" as const, manualQuantity: { quantity: 1, unit: "pack" }, name: "napkins", canonicalUnitKind: null, category: "nonfood" },
  { ingredientId: "apple", source: "manual" as const, manualQuantity: null, name: "apple", canonicalUnitKind: "count" as const, category: "produce" },
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
      [{ ingredientId: "x", name: "mystery", amount: 1, optional: false, category: null, canonicalUnitKind: null }],
      [],
    );
    expect(groupShopItems(items)[0].key).toBe("other");
  });

  it("sorts items alphabetically within a group", () => {
    const items = buildShopItems(
      [
        { ingredientId: "b", name: "banana", amount: 1, optional: false, category: "produce", canonicalUnitKind: "count" },
        { ingredientId: "a", name: "apple", amount: 1, optional: false, category: "produce", canonicalUnitKind: "count" },
      ],
      [],
    );
    expect(groupShopItems(items)[0].items.map((i) => i.name)).toEqual(["apple", "banana"]);
  });
});

describe("shopItemAmountLabel", () => {
  it("formats a need's canonical amount", () => {
    const item = buildShopItems([NEEDS[0]], [])[0];
    expect(shopItemAmountLabel(item)).toBe("450 g");
  });
  it("uses the manual quantity when present, blank otherwise", () => {
    const [napkins, apple] = buildShopItems([], MANUAL);
    expect(shopItemAmountLabel(napkins)).toBe("1 pack");
    expect(shopItemAmountLabel(apple)).toBe("");
  });
});
