import { describe, it, expect } from "vitest";
import { cookProgress } from "@/lib/cook-progress";

describe("cookProgress", () => {
  it("reports completed count and clamps the index", () => {
    expect(cookProgress(0, 5)).toEqual({ current: 0, total: 5, completed: 0, isLast: false });
    expect(cookProgress(2, 5)).toEqual({ current: 2, total: 5, completed: 2, isLast: false });
    expect(cookProgress(4, 5)).toEqual({ current: 4, total: 5, completed: 4, isLast: true });
  });
  it("clamps out-of-range indices", () => {
    expect(cookProgress(-3, 5).current).toBe(0);
    expect(cookProgress(99, 5).current).toBe(4);
  });
  it("handles zero steps", () => {
    expect(cookProgress(0, 0)).toEqual({ current: 0, total: 0, completed: 0, isLast: true });
  });
});
