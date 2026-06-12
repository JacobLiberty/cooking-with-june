import { describe, it, expect } from "vitest";
import { slugify, uniqueSlug } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases, trims, and hyphenates", () => {
    expect(slugify("Weeknight Beef Ragù")).toBe("weeknight-beef-ragu");
    expect(slugify("  Garlic   Butter Spaghetti! ")).toBe("garlic-butter-spaghetti");
    expect(slugify("Mac & Cheese")).toBe("mac-cheese");
  });
  it("returns empty string for empty input", () => {
    expect(slugify("")).toBe("");
    expect(slugify("   ")).toBe("");
  });
});

describe("uniqueSlug", () => {
  it("returns the base when free", () => {
    expect(uniqueSlug("chili", [])).toBe("chili");
  });
  it("appends the first free suffix on collision", () => {
    expect(uniqueSlug("chili", ["chili", "chili-2"])).toBe("chili-3");
  });
});
