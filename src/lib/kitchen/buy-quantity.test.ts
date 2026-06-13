import { describe, it, expect } from "vitest";
import { resolveBuyQuantity } from "@/lib/kitchen/buy-quantity";

const base = { override: null, restockCanonical: null, needAmount: null, manualCanonical: null };

describe("resolveBuyQuantity", () => {
  it("prefers the stored override", () => {
    expect(resolveBuyQuantity({ ...base, override: 500, restockCanonical: 473, needAmount: 240 })).toBe(500);
  });
  it("falls back to the restock default", () => {
    expect(resolveBuyQuantity({ ...base, restockCanonical: 473, needAmount: 240 })).toBe(473);
  });
  it("falls back to the needed amount, rounded up", () => {
    expect(resolveBuyQuantity({ ...base, needAmount: 239.2 })).toBe(240);
  });
  it("falls back to the manual quantity, rounded up", () => {
    expect(resolveBuyQuantity({ ...base, manualCanonical: 2.5 })).toBe(3);
  });
  it("returns null when nothing is resolvable", () => {
    expect(resolveBuyQuantity(base)).toBe(null);
  });
  it("ignores zero/negative/NaN candidates and never returns less than 1", () => {
    expect(resolveBuyQuantity({ ...base, restockCanonical: 0, needAmount: 0.2 })).toBe(1);
    expect(resolveBuyQuantity({ ...base, restockCanonical: NaN, needAmount: -3 })).toBe(null);
  });
});
