import { describe, it, expect } from "vitest";
import { lineToGrams } from "@/lib/kitchen/convert";
import type { ConversionMeta } from "@/lib/kitchen/types";

const mass: ConversionMeta = { canonicalUnitKind: "mass" };
const volumeWithDensity: ConversionMeta = { canonicalUnitKind: "volume", density: 0.5 };
const countWithWeight: ConversionMeta = { canonicalUnitKind: "count", avgUnitGrams: 40 };

describe("lineToGrams", () => {
  it("mass units are exact and ignore metadata", () => {
    expect(lineToGrams("2", "lb", mass, "flour")).toEqual({ grams: 2 * 453.6 });
  });

  it("volume uses stored density over the name heuristic", () => {
    expect(lineToGrams("1", "cup", volumeWithDensity, "mystery goo")).toEqual({ grams: 120 });
  });

  it("volume falls back to the name heuristic when no stored density", () => {
    const r = lineToGrams("1", "cup", { canonicalUnitKind: "volume" }, "flour");
    expect(r).toEqual({ grams: 240 * 0.53 });
  });

  it("count uses stored avgUnitGrams over the heuristic", () => {
    expect(lineToGrams("3", "", countWithWeight, "egg")).toEqual({ grams: 120 });
  });

  it("count falls back to the name heuristic when no stored weight", () => {
    expect(lineToGrams("2", "", { canonicalUnitKind: "count" }, "egg")).toEqual({ grams: 100 });
  });

  it("reports unparseable when there is no numeric quantity", () => {
    const r = lineToGrams("a pinch", "", mass, "salt");
    expect("unparseable" in r && r.unparseable).toBe(true);
  });

  it("reports unparseable for a count with no known item weight", () => {
    const r = lineToGrams("2", "", { canonicalUnitKind: "count" }, "dragonfruit");
    expect("unparseable" in r && r.unparseable).toBe(true);
  });

  it("reports unparseable for an unknown unit", () => {
    const r = lineToGrams("2", "smidgen", mass, "salt");
    expect("unparseable" in r && r.unparseable).toBe(true);
  });
});
