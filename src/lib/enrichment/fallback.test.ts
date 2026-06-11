import { describe, it, expect } from "vitest";
import { fallbackMetadata, mergeWithFallback } from "@/lib/enrichment/fallback";

describe("fallbackMetadata", () => {
  it("count-kind for a known count ingredient (egg)", () => {
    const fb = fallbackMetadata("egg");
    expect(fb.canonicalUnitKind).toBe("count");
    expect(fb.avgUnitGrams).toBe(50);
  });

  it("volume-kind with density for a known density ingredient (flour)", () => {
    const fb = fallbackMetadata("all-purpose flour");
    expect(fb.canonicalUnitKind).toBe("volume");
    expect(fb.density).toBe(0.53);
  });

  it("no kind guess for an unknown ingredient", () => {
    const fb = fallbackMetadata("dragonfruit");
    expect(fb.canonicalUnitKind).toBeUndefined();
  });
});

describe("mergeWithFallback", () => {
  it("fills missing avgUnitGrams from the fallback", () => {
    const merged = mergeWithFallback(
      { canonicalUnitKind: "count", category: "produce", restockQuantity: { quantity: 12, unit: "" } },
      "egg",
    );
    expect(merged.avgUnitGrams).toBe(50);
  });

  it("does not overwrite values the model supplied", () => {
    const merged = mergeWithFallback(
      { canonicalUnitKind: "count", avgUnitGrams: 55, category: "produce", restockQuantity: { quantity: 12, unit: "" } },
      "egg",
    );
    expect(merged.avgUnitGrams).toBe(55);
  });
});
