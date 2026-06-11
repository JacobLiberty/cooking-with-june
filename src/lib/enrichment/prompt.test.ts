import { describe, it, expect } from "vitest";
import { buildSystemRules, buildUserPrompt, ENRICHMENT_TOOL } from "@/lib/enrichment/prompt";

describe("buildSystemRules", () => {
  const rules = buildSystemRules();

  it("documents the three unit kinds", () => {
    expect(rules).toMatch(/mass/);
    expect(rules).toMatch(/volume/);
    expect(rules).toMatch(/count/);
  });

  it("seeds known ground-truth examples from the macros lib", () => {
    expect(rules).toMatch(/flour/);
    expect(rules).toMatch(/0\.53/);
    expect(rules).toMatch(/egg/);
  });

  it("explains nonfood exclusion", () => {
    expect(rules.toLowerCase()).toMatch(/nonfood/);
  });
});

describe("buildUserPrompt", () => {
  it("lists each ingredient name", () => {
    const prompt = buildUserPrompt(["egg", "olive oil"]);
    expect(prompt).toMatch(/egg/);
    expect(prompt).toMatch(/olive oil/);
  });
});

describe("ENRICHMENT_TOOL", () => {
  it("describes a per-ingredient array result", () => {
    expect(ENRICHMENT_TOOL.input_schema.type).toBe("object");
    const items = ENRICHMENT_TOOL.input_schema.properties.items;
    expect(items.type).toBe("array");
    expect(items.items.properties.canonicalUnitKind.enum).toEqual(["mass", "volume", "count"]);
  });
});
