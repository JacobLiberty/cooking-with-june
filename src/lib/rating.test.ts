import { describe, it, expect } from "vitest";
import { averageRating } from "@/lib/rating";

describe("averageRating", () => {
  it("returns null for no ratings", () => {
    expect(averageRating(null)).toBeNull();
    expect(averageRating([])).toBeNull();
  });
  it("returns the single rating value", () => {
    expect(averageRating([{ editor: "Jacob", value: 4.5 }])).toBe(4.5);
  });
  it("averages and rounds to the nearest half star", () => {
    expect(
      averageRating([
        { editor: "Jacob", value: 4 },
        { editor: "Lily", value: 5 },
      ]),
    ).toBe(4.5);
    expect(
      averageRating([
        { editor: "Jacob", value: 4 },
        { editor: "Lily", value: 3 },
      ]),
    ).toBe(3.5);
    // 4 + 4 + 5 = 13/3 = 4.33 -> nearest half = 4.5
    expect(
      averageRating([
        { editor: "A", value: 4 },
        { editor: "B", value: 4 },
        { editor: "C", value: 5 },
      ]),
    ).toBe(4.5);
  });
});
