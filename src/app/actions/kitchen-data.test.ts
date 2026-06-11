import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/viewer", () => ({ requireMember: vi.fn() }));
vi.mock("@convex-dev/auth/nextjs/server", () => ({
  convexAuthNextjsToken: vi.fn().mockResolvedValue("tok"),
}));
const fetchQuery = vi.fn();
vi.mock("convex/nextjs", () => ({ fetchQuery: (...a: unknown[]) => fetchQuery(...a) }));
const sanityFetch = vi.fn();
vi.mock("@/sanity/lib/client", () => ({
  client: { withConfig: () => ({ fetch: (...a: unknown[]) => sanityFetch(...a) }) },
}));

import { requireMember } from "@/lib/viewer";
import { getShopData, getCookableCoverage, getPlanData } from "@/app/actions/kitchen-data";

const REQS = [
  {
    _id: "r1",
    servings: 2,
    lines: [
      { ingredientId: "beef", name: "beef", quantity: "1", unit: "lb", optional: false,
        canonicalUnitKind: "mass", density: null, avgUnitGrams: null, category: "protein", restockQuantity: null },
      { ingredientId: "herb", name: "herb", quantity: "10", unit: "g", optional: true,
        canonicalUnitKind: "mass", density: null, avgUnitGrams: null, category: "spice", restockQuantity: null },
    ],
  },
];

beforeEach(() => {
  vi.mocked(requireMember).mockResolvedValue({ userId: "u1", householdId: "h1" });
  fetchQuery.mockReset();
  sanityFetch.mockReset();
});

describe("getShopData", () => {
  it("computes plan needs minus pantry, excludes skipped, includes manual", async () => {
    fetchQuery
      .mockResolvedValueOnce([{ recipeId: "r1", scale: 1, addedAt: 1 }]) // plan
      .mockResolvedValueOnce([{ ingredientId: "beef", quantityG: 100, restockOverride: null, updatedAt: 1 }]) // pantry
      .mockResolvedValueOnce([
        { ingredientId: "herb", source: "skip", manualQuantity: null },
        { ingredientId: "salt", source: "manual", manualQuantity: { quantity: 1, unit: "box" } },
      ]); // grocery
    sanityFetch.mockResolvedValueOnce(REQS);

    const data = await getShopData();
    const beef = data.needs.find((n) => n.ingredientId === "beef");
    expect(beef?.amount).toBeCloseTo(353.6);
    expect(data.needs.some((n) => n.ingredientId === "herb")).toBe(false);
    expect(data.manual.map((m) => m.ingredientId)).toEqual(["salt"]);
    expect(data.skipped).toEqual(["herb"]);
  });
});

describe("getCookableCoverage", () => {
  it("returns per-recipe coverage against the pantry", async () => {
    fetchQuery.mockResolvedValueOnce([
      { ingredientId: "beef", quantityG: 500, restockOverride: null, updatedAt: 1 },
    ]); // pantry
    sanityFetch.mockResolvedValueOnce(REQS);
    const cov = await getCookableCoverage(["r1"]);
    expect(cov.r1).toEqual({ cookable: true, missingRequired: 0 });
  });
});

describe("getPlanData", () => {
  it("returns each planned recipe with its scale and scaled coverage", async () => {
    fetchQuery
      .mockResolvedValueOnce([{ recipeId: "r1", scale: 2 }]) // plan
      .mockResolvedValueOnce([{ ingredientId: "beef", quantityG: 500, restockOverride: null, updatedAt: 1 }]); // pantry
    sanityFetch.mockResolvedValueOnce(REQS);
    const data = await getPlanData();
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ recipeId: "r1", scale: 2 });
    // beef required at 2x = 907.2g, pantry 500 -> short -> not cookable
    expect(data[0].coverage).toEqual({ cookable: false, missingRequired: 1 });
  });
});

describe("auth", () => {
  it("getShopData rejects when not a member", async () => {
    vi.mocked(requireMember).mockRejectedValueOnce(new Error("Not authorized"));
    await expect(getShopData()).rejects.toThrow(/authorized/i);
  });
});
