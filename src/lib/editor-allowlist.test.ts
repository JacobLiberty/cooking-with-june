import { describe, it, expect } from "vitest";
import { normalizeEmail, findEditorByEmail } from "@/lib/editor-allowlist";

const editors = [
  { _id: "e1", name: "Jacob", email: "jacob.tobin.liberty@gmail.com" },
  { _id: "e2", name: "Lily", email: "Lily@example.com" },
];

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Jacob@GMAIL.com ")).toBe("jacob@gmail.com");
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(undefined)).toBe("");
  });
});

describe("findEditorByEmail", () => {
  it("matches case-insensitively", () => {
    expect(findEditorByEmail(editors, "JACOB.TOBIN.LIBERTY@gmail.com")?.name).toBe("Jacob");
    expect(findEditorByEmail(editors, "lily@example.com")?.name).toBe("Lily");
  });
  it("returns null for non-editors or empty input", () => {
    expect(findEditorByEmail(editors, "stranger@example.com")).toBeNull();
    expect(findEditorByEmail(editors, "")).toBeNull();
    expect(findEditorByEmail(editors, null)).toBeNull();
  });
});
