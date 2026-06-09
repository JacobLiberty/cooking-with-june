import { describe, it, expect } from "vitest";
import { groceryMetaByIngredient, type PlannedRecipe } from "@/lib/grocery";

function recipe(id: string, lines: PlannedRecipe["ingredients"]): PlannedRecipe {
  return { _id: id, ingredients: lines };
}

describe("groceryMetaByIngredient", () => {
  it("counts how many planned recipes use each ingredient", () => {
    const meta = groceryMetaByIngredient([
      recipe("r1", [{ ingredientId: "garlic", name: "garlic" }]),
      recipe("r2", [{ ingredientId: "garlic", name: "garlic" }]),
      recipe("r3", [{ ingredientId: "basil", name: "basil" }]),
    ]);
    expect(meta.get("garlic")?.recipeCount).toBe(2);
    expect(meta.get("basil")?.recipeCount).toBe(1);
  });

  it("tags an ingredient optional only when a single recipe uses it and marks it optional", () => {
    const meta = groceryMetaByIngredient([
      recipe("r1", [{ ingredientId: "mint", name: "mint", optional: true }]),
    ]);
    expect(meta.get("mint")).toEqual({ recipeCount: 1, isOptional: true });
  });

  it("does not tag a single-recipe required ingredient optional", () => {
    const meta = groceryMetaByIngredient([
      recipe("r1", [{ ingredientId: "flour", name: "flour" }]),
    ]);
    expect(meta.get("flour")).toEqual({ recipeCount: 1, isOptional: false });
  });

  it("treats an ingredient used by 2+ recipes as mandatory even if one marks it optional", () => {
    const meta = groceryMetaByIngredient([
      recipe("r1", [{ ingredientId: "garlic", name: "garlic", optional: true }]),
      recipe("r2", [{ ingredientId: "garlic", name: "garlic" }]),
    ]);
    expect(meta.get("garlic")).toEqual({ recipeCount: 2, isOptional: false });
  });

  it("treats an ingredient optional in BOTH of two recipes as mandatory (2+ rule wins)", () => {
    const meta = groceryMetaByIngredient([
      recipe("r1", [{ ingredientId: "chili", name: "chili", optional: true }]),
      recipe("r2", [{ ingredientId: "chili", name: "chili", optional: true }]),
    ]);
    expect(meta.get("chili")).toEqual({ recipeCount: 2, isOptional: false });
  });

  it("ignores lines without an ingredient id and handles null ingredient arrays", () => {
    const meta = groceryMetaByIngredient([
      recipe("r1", [{ ingredientId: null, name: "mystery" }]),
      recipe("r2", null),
    ]);
    expect(meta.size).toBe(0);
  });
});
