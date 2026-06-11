import { describe, it, expect } from "vitest";
import { validateEnrichmentResult } from "@/lib/enrichment/validate";

const valid = {
  canonicalUnitKind: "count",
  avgUnitGrams: 50,
  restockQuantity: { quantity: 12, unit: "" },
  category: "produce",
};

describe("validateEnrichmentResult", () => {
  it("accepts a well-formed count result", () => {
    const r = validateEnrichmentResult(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.avgUnitGrams).toBe(50);
  });

  it("rejects an unknown canonicalUnitKind", () => {
    const r = validateEnrichmentResult({ ...valid, canonicalUnitKind: "blob" });
    expect(r.ok).toBe(false);
  });

  it("rejects a non-positive avgUnitGrams", () => {
    const r = validateEnrichmentResult({ ...valid, avgUnitGrams: 0 });
    expect(r.ok).toBe(false);
  });

  it("rejects a missing restock quantity", () => {
    const r = validateEnrichmentResult({ ...valid, restockQuantity: { unit: "lb" } });
    expect(r.ok).toBe(false);
  });

  it("rejects an unknown category", () => {
    const r = validateEnrichmentResult({ ...valid, category: "snacks" });
    expect(r.ok).toBe(false);
  });

  it("rejects a non-object", () => {
    expect(validateEnrichmentResult(null).ok).toBe(false);
    expect(validateEnrichmentResult("x").ok).toBe(false);
  });

  it("volume-kind requires a positive density", () => {
    expect(validateEnrichmentResult({ canonicalUnitKind: "volume", restockQuantity: { quantity: 1, unit: "l" }, category: "pantry" }).ok).toBe(false);
    expect(validateEnrichmentResult({ canonicalUnitKind: "volume", density: 0.9, restockQuantity: { quantity: 1, unit: "l" }, category: "pantry" }).ok).toBe(true);
  });
});
