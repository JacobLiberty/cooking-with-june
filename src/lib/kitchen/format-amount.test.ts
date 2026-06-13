import { describe, it, expect } from "vitest";
import {
  roundForDisplay,
  formatCanonicalAmount,
  canonicalUnitLabel,
  pantryNudgeStep,
} from "@/lib/kitchen/format-amount";

describe("roundForDisplay", () => {
  it("rounds to whole numbers (half up)", () => {
    expect(roundForDisplay(2.5)).toBe(3);
    expect(roundForDisplay(2.4)).toBe(2);
    expect(roundForDisplay(740.3)).toBe(740);
    expect(roundForDisplay(0.4)).toBe(0);
  });
});

describe("formatCanonicalAmount", () => {
  it("formats mass/volume as whole grams", () => {
    expect(formatCanonicalAmount(473.2, "mass")).toBe("473 g");
    expect(formatCanonicalAmount(239.6, "volume")).toBe("240 g");
  });
  it("formats count as a bare whole number", () => {
    expect(formatCanonicalAmount(2.5, "count")).toBe("3");
    expect(formatCanonicalAmount(3, null)).toBe("3");
  });
});

describe("canonicalUnitLabel", () => {
  it("labels kinds", () => {
    expect(canonicalUnitLabel("mass")).toBe("g");
    expect(canonicalUnitLabel("volume")).toBe("g");
    expect(canonicalUnitLabel("count")).toBe("ct");
    expect(canonicalUnitLabel(null)).toBe("units");
  });
});

describe("pantryNudgeStep", () => {
  it("nudges 10 g for mass/volume, 1 for count", () => {
    expect(pantryNudgeStep("mass")).toBe(10);
    expect(pantryNudgeStep("count")).toBe(1);
  });
});
