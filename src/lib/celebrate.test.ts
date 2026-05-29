import { describe, it, expect } from "vitest";
import { shouldCelebrate } from "@/lib/celebrate";

describe("shouldCelebrate", () => {
  it("celebrates only a perfect 5", () => {
    expect(shouldCelebrate(5)).toBe(true);
    expect(shouldCelebrate(4.5)).toBe(false);
    expect(shouldCelebrate(0)).toBe(false);
  });
});
