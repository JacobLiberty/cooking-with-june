import { describe, it, expect } from "vitest";
import { buildImportSystemRules, buildImportUserPrompt, IMPORT_TOOL } from "@/lib/import/prompt";

describe("buildImportSystemRules", () => {
  const rules = buildImportSystemRules();
  it("forbids em dashes and AI tells (style guard)", () => {
    expect(rules).toMatch(/em dash|—/i);
    expect(rules.toLowerCase()).toContain("optional");
  });
  it("instructs per-100g nutrients per ingredient", () => {
    expect(rules.toLowerCase()).toMatch(/per[- ]?100\s?g/);
  });
});

describe("buildImportUserPrompt", () => {
  it("embeds the pasted blurb", () => {
    expect(buildImportUserPrompt("Grandma's chili")).toContain("Grandma's chili");
  });
});

describe("IMPORT_TOOL", () => {
  it("is a forced-tool schema with the recipe fields", () => {
    expect(IMPORT_TOOL.name).toBe("import_recipe");
    const props = IMPORT_TOOL.input_schema.properties;
    expect(Object.keys(props)).toEqual(
      expect.arrayContaining(["title", "ingredients", "steps", "candidateTags"]),
    );
    expect(IMPORT_TOOL.input_schema.required).toEqual(
      expect.arrayContaining(["title", "description", "ingredients", "steps"]),
    );
    const line = props.ingredients.items.properties;
    expect(Object.keys(line)).toEqual(
      expect.arrayContaining(["name", "optional", "per100g"]),
    );
    expect(Object.keys(line.per100g.properties)).toEqual(
      expect.arrayContaining(["calories", "protein", "carbs", "fat"]),
    );
  });
});
