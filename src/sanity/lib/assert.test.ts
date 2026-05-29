import { describe, it, expect } from "vitest";
import { assertValue } from "@/sanity/lib/assert";

describe("assertValue", () => {
  it("returns the value when it is defined", () => {
    expect(assertValue("production", "missing")).toBe("production");
    expect(assertValue(0, "missing")).toBe(0);
    expect(assertValue("", "missing")).toBe("");
  });

  it("throws the given message when the value is undefined", () => {
    expect(() => assertValue(undefined, "Missing NEXT_PUBLIC_SANITY_DATASET")).toThrowError(
      "Missing NEXT_PUBLIC_SANITY_DATASET",
    );
  });
});
