import { describe, it, expect } from "vitest";
import { formatMinutes, totalTime } from "@/lib/format";

describe("formatMinutes", () => {
  it("returns null for missing or non-positive values", () => {
    expect(formatMinutes(undefined)).toBeNull();
    expect(formatMinutes(0)).toBeNull();
  });
  it("formats minutes, hours, and combos", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1 hr");
    expect(formatMinutes(75)).toBe("1 hr 15 min");
  });
});

describe("totalTime", () => {
  it("sums prep and cook", () => {
    expect(totalTime(10, 35)).toBe("45 min");
    expect(totalTime(undefined, 60)).toBe("1 hr");
    expect(totalTime(undefined, undefined)).toBeNull();
  });
});
