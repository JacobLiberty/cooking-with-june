import { describe, it, expect } from "vitest";
import { scaleQuantity, servingFactor } from "@/lib/scale";

describe("scaleQuantity", () => {
  it("returns the quantity unchanged at factor 1", () => {
    expect(scaleQuantity("1 1/2", 1)).toBe("1 1/2");
  });

  it("scales whole numbers and decimals", () => {
    expect(scaleQuantity("2", 2)).toBe("4");
    expect(scaleQuantity("1.5", 2)).toBe("3");
    expect(scaleQuantity("3", 0.5)).toBe("1.5");
  });

  it("scales simple and mixed fractions", () => {
    expect(scaleQuantity("1/2", 2)).toBe("1");
    expect(scaleQuantity("3/4", 2)).toBe("1.5");
    expect(scaleQuantity("1 1/2", 2)).toBe("3");
  });

  it("scales both ends of a range", () => {
    expect(scaleQuantity("1-2", 2)).toBe("2–4");
    expect(scaleQuantity("2 – 3", 0.5)).toBe("1–1.5");
  });

  it("leaves non-numeric quantities alone", () => {
    expect(scaleQuantity("a pinch", 3)).toBe("a pinch");
    expect(scaleQuantity("to taste", 2)).toBe("to taste");
    expect(scaleQuantity("", 2)).toBe("");
    expect(scaleQuantity(undefined, 2)).toBe("");
  });

  it("rounds cleanly", () => {
    expect(scaleQuantity("1/3", 1.5)).toBe("0.5");
    expect(scaleQuantity("1", 0.333)).toBe("0.33");
  });
});

describe("servingFactor", () => {
  it("computes target / base", () => {
    expect(servingFactor(4, 8)).toBe(2);
    expect(servingFactor(4, 2)).toBe(0.5);
  });
  it("defaults to 1 for missing or invalid base/target", () => {
    expect(servingFactor(undefined, 4)).toBe(1);
    expect(servingFactor(0, 4)).toBe(1);
    expect(servingFactor(4, 0)).toBe(1);
  });
});
