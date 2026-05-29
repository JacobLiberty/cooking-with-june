import { describe, it, expect } from "vitest";
import { normalizeEmail } from "@/lib/editor-allowlist";

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Jacob@GMAIL.com ")).toBe("jacob@gmail.com");
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(undefined)).toBe("");
  });
});
