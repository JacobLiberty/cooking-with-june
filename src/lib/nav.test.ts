import { describe, it, expect } from "vitest";
import { isActivePath } from "@/lib/nav";

describe("isActivePath", () => {
  it("marks root active only on the exact root path", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/about", "/")).toBe(false);
  });

  it("marks a section active on an exact match", () => {
    expect(isActivePath("/about", "/about")).toBe(true);
  });

  it("marks a section active on nested sub-paths", () => {
    expect(isActivePath("/recipe/sunday-stew", "/recipe")).toBe(true);
  });

  it("does not match unrelated paths or partial prefixes", () => {
    expect(isActivePath("/about-us", "/about")).toBe(false);
    expect(isActivePath("/contact", "/about")).toBe(false);
  });
});
