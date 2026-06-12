import { describe, it, expect } from "vitest";
import { schemaTypes } from "@/sanity/schemaTypes";
import { recipe } from "@/sanity/schemaTypes/documents/recipe";
import { ingredient } from "@/sanity/schemaTypes/documents/ingredient";

function fieldByName(type: typeof recipe, name: string) {
  return type.fields.find((f) => f.name === name);
}

describe("schema content model", () => {
  it("registers all document types and object types", () => {
    const names = schemaTypes.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "recipe",
        "ingredient",
        "tag",
        "ingredientLine",
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

});

describe("ingredient stock metadata (Spec 2a)", () => {
  const names = ingredient.fields.map((f) => f.name);

  it("has the stock-metadata fields", () => {
    expect(names).toEqual(
      expect.arrayContaining([
        "canonicalUnitKind",
        "density",
        "avgUnitGrams",
        "restockQuantity",
      ]),
    );
  });

  it("category list includes nonfood", () => {
    const category = ingredient.fields.find((f) => f.name === "category");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values = (category as any).options.list.map((o: any) => o.value);
    expect(values).toContain("nonfood");
  });

  it("canonicalUnitKind is constrained to mass/volume/count", () => {
    const kind = ingredient.fields.find((f) => f.name === "canonicalUnitKind");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values = (kind as any).options.list.map((o: any) => o.value);
    expect(values).toEqual(["mass", "volume", "count"]);
  });

  it("restockQuantity is an object with quantity + unit", () => {
    const restock = ingredient.fields.find((f) => f.name === "restockQuantity");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub = (restock as any).fields.map((f: any) => f.name);
    expect(sub).toEqual(expect.arrayContaining(["quantity", "unit"]));
  });

  it("density and avgUnitGrams are numbers", () => {
    const density = ingredient.fields.find((f) => f.name === "density");
    const avg = ingredient.fields.find((f) => f.name === "avgUnitGrams");
    expect(density?.type).toBe("number");
    expect(avg?.type).toBe("number");
  });

  it("restockQuantity sub-fields are typed (quantity number, unit string)", () => {
    const restock = ingredient.fields.find((f) => f.name === "restockQuantity");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub = (restock as any).fields as any[];
    expect(sub.find((f) => f.name === "quantity")?.type).toBe("number");
    expect(sub.find((f) => f.name === "unit")?.type).toBe("string");
  });
});
