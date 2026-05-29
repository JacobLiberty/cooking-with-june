import { describe, it, expect } from "vitest";
import { schemaTypes } from "@/sanity/schemaTypes";
import { recipe } from "@/sanity/schemaTypes/documents/recipe";

function fieldByName(type: typeof recipe, name: string) {
  return type.fields.find((f) => f.name === name);
}

describe("schema content model", () => {
  it("registers all four document types and three object types", () => {
    const names = schemaTypes.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "recipe",
        "ingredient",
        "tag",
        "editor",
        "ingredientLine",
        "rating",
        "recipeNote",
      ]),
    );
  });

  it("recipe has the core fields from the spec", () => {
    const names = recipe.fields.map((f) => f.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "title",
        "slug",
        "description",
        "story",
        "images",
        "ingredients",
        "steps",
        "prepTime",
        "cookTime",
        "servings",
        "tags",
        "ratings",
        "wishlist",
        "madeCount",
        "lastMadeAt",
        "notes",
      ]),
    );
  });

  it("recipe.ingredients is a list of ingredientLine objects", () => {
    const ingredients = fieldByName(recipe, "ingredients");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((ingredients as any).of[0].type).toBe("ingredientLine");
  });

  it("recipe.tags references the tag document", () => {
    const tags = fieldByName(recipe, "tags");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const member = (tags as any).of[0];
    expect(member.type).toBe("reference");
    expect(member.to[0].type).toBe("tag");
  });

  it("recipe.ratings is a list of rating objects", () => {
    const ratings = fieldByName(recipe, "ratings");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((ratings as any).of[0].type).toBe("rating");
  });
});
