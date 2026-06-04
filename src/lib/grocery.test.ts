import { describe, it, expect } from "vitest";
import { buildGroceryList, type PlanIngredient } from "@/lib/grocery";

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
