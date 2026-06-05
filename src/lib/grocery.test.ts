import { describe, it, expect } from "vitest";
import {
  buildGroceryList,
  partitionGrocery,
  type GroceryItem,
  type PlanIngredient,
} from "@/lib/grocery";

function ing(
  ingredientId: string,
  name: string,
  quantity?: string,
  unit?: string,
): PlanIngredient {
  return { ingredientId, name, quantity, unit };
}

describe("buildGroceryList", () => {
  it("dedupes by ingredient and collects amounts", () => {
    const list = buildGroceryList([
      [ing("onion", "onion", "1", ""), ing("cream", "cream", "1", "cup")],
      [ing("onion", "onion", "2", ""), ing("cream", "cream", "0.5", "L")],
    ]);
    const onion = list.find((i) => i.ingredientId === "onion");
    const cream = list.find((i) => i.ingredientId === "cream");
    expect(list).toHaveLength(2);
    expect(onion?.amounts).toEqual(["1", "2"]);
    expect(cream?.amounts).toEqual(["1 cup", "0.5 L"]);
  });

  it("skips ingredients with no id and omits empty amounts", () => {
    const list = buildGroceryList([
      [ing("", "mystery"), ing("salt", "salt")], // no-id dropped; salt has no amount
    ]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ ingredientId: "salt", name: "salt", amounts: [] });
  });

  it("does not duplicate an amount string", () => {
    const list = buildGroceryList([
      [ing("egg", "egg", "2", "")],
      [ing("egg", "egg", "2", "")],
    ]);
    expect(list[0].amounts).toEqual(["2"]);
  });
});

describe("partitionGrocery", () => {
  const item = (id: string): GroceryItem => ({
    ingredientId: id,
    name: id,
    amounts: [],
  });
  const items = [item("a"), item("b"), item("c"), item("d")];

  it("places each item in exactly one section", () => {
    const { toGet, got, skipped } = partitionGrocery(
      items,
      new Set(["b"]),
      new Set(["c"]),
    );
    expect(got.map((i) => i.ingredientId)).toEqual(["b"]);
    expect(skipped.map((i) => i.ingredientId)).toEqual(["c"]);
    expect(toGet.map((i) => i.ingredientId)).toEqual(["a", "d"]);
    // No item is lost or duplicated across sections.
    expect(toGet.length + got.length + skipped.length).toBe(items.length);
  });

  it("never drops an item that is in both checked and skipped (checked wins)", () => {
    const { toGet, got, skipped } = partitionGrocery(
      items,
      new Set(["a"]),
      new Set(["a"]),
    );
    expect(got.map((i) => i.ingredientId)).toEqual(["a"]);
    expect(skipped).toHaveLength(0);
    expect(toGet.map((i) => i.ingredientId)).toEqual(["b", "c", "d"]);
    expect(toGet.length + got.length + skipped.length).toBe(items.length);
  });

  it("puts everything in to-get when nothing is checked or skipped", () => {
    const { toGet, got, skipped } = partitionGrocery(items, new Set(), new Set());
    expect(toGet).toHaveLength(items.length);
    expect(got).toHaveLength(0);
    expect(skipped).toHaveLength(0);
  });
});
