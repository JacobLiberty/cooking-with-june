import { describe, it, expect } from "vitest";
import {
  roundForDisplay,
  formatCanonicalAmount,
  canonicalUnitLabel,
  pantryNudgeStep,
} from "@/lib/kitchen/format-amount";

describe("roundForDisplay", () => {
  it("keeps whole numbers whole", () => {
    expect(roundForDisplay(200)).toBe(200);
    expect(roundForDisplay(4)).toBe(4);
  });
  it("rounds to at most one decimal", () => {
    expect(roundForDisplay(4.84)).toBe(4.8);
    expect(roundForDisplay(4.85)).toBe(4.9);
    expect(roundForDisplay(0.04)).toBe(0);
  });
});

describe("formatCanonicalAmount", () => {
  it("labels mass and volume kinds in grams", () => {
    expect(formatCanonicalAmount(200, "mass")).toBe("200 g");
    expect(formatCanonicalAmount(355.5, "volume")).toBe("355.5 g");
  });
  it("shows a bare number for count kind (fractional allowed)", () => {
    expect(formatCanonicalAmount(4, "count")).toBe("4");
    expect(formatCanonicalAmount(4.8, "count")).toBe("4.8");
  });
  it("shows a bare number when the kind is unknown", () => {
    expect(formatCanonicalAmount(50, null)).toBe("50");
  });
});

describe("canonicalUnitLabel", () => {
  it("returns g for mass/volume, count for count, units for unknown", () => {
    expect(canonicalUnitLabel("mass")).toBe("g");
    expect(canonicalUnitLabel("volume")).toBe("g");
    expect(canonicalUnitLabel("count")).toBe("count");
    expect(canonicalUnitLabel(null)).toBe("units");
  });
});

describe("pantryNudgeStep", () => {
  it("nudges count by 1 and mass/volume by 10", () => {
    expect(pantryNudgeStep("count")).toBe(1);
    expect(pantryNudgeStep("mass")).toBe(10);
    expect(pantryNudgeStep("volume")).toBe(10);
    expect(pantryNudgeStep(null)).toBe(10);
  });
});
