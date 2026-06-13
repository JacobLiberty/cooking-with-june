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
import { getShopData, getCookableCoverage, getPlanData, getPantryData, getMenuData, getPlannedRecipeIds } from "@/app/actions/kitchen-data";

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
      .mockResolvedValueOnce([{ ingredientId: "beef", quantityG: 100, updatedAt: 1 }]) // pantry
      .mockResolvedValueOnce([
        { ingredientId: "herb", source: "skip", manualQuantity: null, buyQuantityG: null },
        { ingredientId: "salt", source: "manual", manualQuantity: { quantity: 1, unit: "box" }, buyQuantityG: null },
      ]); // grocery
    sanityFetch.mockResolvedValueOnce(REQS);

    const data = await getShopData();
    const beef = data.needs.find((n) => n.ingredientId === "beef");
    expect(beef?.amount).toBeCloseTo(353.6);
    expect(data.needs.some((n) => n.ingredientId === "herb")).toBe(false);
    expect(data.manual.map((m) => m.ingredientId)).toEqual(["salt"]);
    expect(data.skipped).toEqual(["herb"]);
  });

  it("folds catalog category and unit kind onto computed needs", async () => {
    fetchQuery
      .mockResolvedValueOnce([{ recipeId: "r1", scale: 1 }]) // plan
      .mockResolvedValueOnce([]) // pantry (empty → everything is a need)
      .mockResolvedValueOnce([]); // grocery
    sanityFetch
      .mockResolvedValueOnce(REQS) // requirements
      .mockResolvedValueOnce([
        { _id: "beef", name: "beef", canonicalUnitKind: "mass", category: "protein", restockQuantity: null, density: null, avgUnitGrams: null },
        { _id: "herb", name: "herb", canonicalUnitKind: "mass", category: "spice", restockQuantity: null, density: null, avgUnitGrams: null },
      ]); // catalog-by-ids for need (+manual) ids

    const data = await getShopData();
    const beef = data.needs.find((n) => n.ingredientId === "beef");
    expect(beef).toMatchObject({ category: "protein", canonicalUnitKind: "mass" });
    const herb = data.needs.find((n) => n.ingredientId === "herb");
    expect(herb).toMatchObject({ optional: true, category: "spice" });
  });

  it("enriches manual rows with catalog name, unit kind, and category", async () => {
    fetchQuery
      .mockResolvedValueOnce([]) // plan (no recipes → no needs)
      .mockResolvedValueOnce([]) // pantry
      .mockResolvedValueOnce([
        { ingredientId: "salt", source: "manual", manualQuantity: { quantity: 1, unit: "box" }, buyQuantityG: null },
      ]); // grocery
    // Empty plan → fetchRequirements short-circuits without a Sanity call, so the
    // only sanityFetch is the catalog lookup for the manual row.
    sanityFetch.mockResolvedValueOnce([
      { _id: "salt", name: "table salt", canonicalUnitKind: "mass", category: "spice", restockQuantity: null, density: null, avgUnitGrams: null },
    ]); // catalog-by-ids for manual rows

    const data = await getShopData();
    expect(data.manual[0]).toMatchObject({
      ingredientId: "salt",
      name: "table salt",
      canonicalUnitKind: "mass",
      category: "spice",
      manualQuantity: { quantity: 1, unit: "box" },
    });
  });

  it("getShopData resolves a buy quantity from override, then restock, then need", async () => {
    const BUY_REQS = [
      {
        _id: "r1",
        servings: 1,
        lines: [
          { ingredientId: "a", name: "a", quantity: "240", unit: "g", optional: false,
            canonicalUnitKind: "mass", density: null, avgUnitGrams: null, category: "protein", restockQuantity: null },
          { ingredientId: "b", name: "b", quantity: "240", unit: "g", optional: false,
            canonicalUnitKind: "mass", density: null, avgUnitGrams: null, category: "protein", restockQuantity: null },
          { ingredientId: "c", name: "c", quantity: "239.2", unit: "g", optional: false,
            canonicalUnitKind: "mass", density: null, avgUnitGrams: null, category: "protein", restockQuantity: null },
        ],
      },
    ];
    fetchQuery
      .mockResolvedValueOnce([{ recipeId: "r1", scale: 1 }]) // plan
      .mockResolvedValueOnce([]) // pantry (empty → all needs)
      .mockResolvedValueOnce([
        { ingredientId: "a", source: "override", manualQuantity: null, buyQuantityG: 500 },
      ]); // grocery
    sanityFetch
      .mockResolvedValueOnce(BUY_REQS) // requirements
      .mockResolvedValueOnce([
        { _id: "a", name: "a", canonicalUnitKind: "mass", category: "protein", restockQuantity: null, density: null, avgUnitGrams: null },
        { _id: "b", name: "b", canonicalUnitKind: "mass", category: "protein", restockQuantity: { quantity: 1, unit: "lb" }, density: null, avgUnitGrams: null },
        { _id: "c", name: "c", canonicalUnitKind: "mass", category: "protein", restockQuantity: null, density: null, avgUnitGrams: null },
      ]); // catalog

    const { needs } = await getShopData();
    const byId = new Map(needs.map((n) => [n.ingredientId, n.buyQuantityG]));
    expect(byId.get("a")).toBe(500); // override wins
    expect(byId.get("b")).toBe(454); // 1 lb → 453.6 g → ceil
    expect(byId.get("c")).toBe(240); // need 239.2 → ceil
  });
});

describe("getCookableCoverage", () => {
  it("returns per-recipe coverage against the pantry", async () => {
    fetchQuery.mockResolvedValueOnce([
      { ingredientId: "beef", quantityG: 500, updatedAt: 1 },
    ]); // pantry
    sanityFetch.mockResolvedValueOnce(REQS);
    const cov = await getCookableCoverage(["r1"]);
    expect(cov.r1).toMatchObject({ cookable: true, missingRequired: 0 });
  });
});

describe("getPlanData", () => {
  it("returns each planned recipe with its scale and scaled coverage", async () => {
    fetchQuery
      .mockResolvedValueOnce([{ recipeId: "r1", scale: 2 }]) // plan
      .mockResolvedValueOnce([{ ingredientId: "beef", quantityG: 500, updatedAt: 1 }]); // pantry
    sanityFetch.mockResolvedValueOnce(REQS);
    const data = await getPlanData();
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ recipeId: "r1", scale: 2 });
    // beef required at 2x = 907.2g, pantry 500 -> short -> not cookable
    expect(data[0].coverage).toMatchObject({ cookable: false, missingRequired: 1 });
  });
});

describe("auth", () => {
  it("getShopData rejects when not a member", async () => {
    vi.mocked(requireMember).mockRejectedValueOnce(new Error("Not authorized"));
    await expect(getShopData()).rejects.toThrow(/authorized/i);
  });
});

describe("getPantryData", () => {
  it("joins catalog name, unit kind, and category onto each pantry row", async () => {
    fetchQuery
      .mockResolvedValueOnce([
        { ingredientId: "beef", quantityG: 200, updatedAt: 1 },
        { ingredientId: "egg", quantityG: 4.8, updatedAt: 2 },
      ]) // pantry
      .mockResolvedValueOnce([]); // grocery
    sanityFetch.mockResolvedValueOnce([
      { _id: "beef", name: "ground beef", canonicalUnitKind: "mass", category: "protein", restockQuantity: { quantity: 1, unit: "lb" }, density: null, avgUnitGrams: null },
      { _id: "egg", name: "egg", canonicalUnitKind: "count", category: "protein", restockQuantity: { quantity: 12, unit: "" }, density: null, avgUnitGrams: null },
    ]); // catalog

    const rows = await getPantryData();
    const beef = rows.find((r) => r.ingredientId === "beef");
    expect(beef).toMatchObject({
      quantityG: 200,
      name: "ground beef",
      canonicalUnitKind: "mass",
      category: "protein",
      onList: false,
    });
    const egg = rows.find((r) => r.ingredientId === "egg");
    expect(egg?.name).toBe("egg");
    expect(egg?.canonicalUnitKind).toBe("count");
    expect(egg?.onList).toBe(false);
  });

  it("falls back to the id as name when the catalog has no match", async () => {
    fetchQuery
      .mockResolvedValueOnce([
        { ingredientId: "ghost", quantityG: 50, updatedAt: 1 },
      ]) // pantry
      .mockResolvedValueOnce([]); // grocery
    sanityFetch.mockResolvedValueOnce([]);
    const rows = await getPantryData();
    expect(rows[0]).toMatchObject({ ingredientId: "ghost", name: "ghost", canonicalUnitKind: null });
  });

  it("getPantryData flags items that already have a manual grocery row", async () => {
    fetchQuery
      .mockResolvedValueOnce([
        { ingredientId: "a", quantityG: 100, updatedAt: 1 },
        { ingredientId: "b", quantityG: 100, updatedAt: 1 },
      ]) // pantry
      .mockResolvedValueOnce([
        { ingredientId: "a", source: "manual", manualQuantity: null, buyQuantityG: null },
      ]); // grocery
    sanityFetch.mockResolvedValueOnce([]); // catalog
    const rows = await getPantryData();
    expect(rows.find((r) => r.ingredientId === "a")?.onList).toBe(true);
    expect(rows.find((r) => r.ingredientId === "b")?.onList).toBe(false);
  });
});

describe("getPlannedRecipeIds", () => {
  it("returns the planned recipe ids from Convex", async () => {
    fetchQuery.mockResolvedValueOnce([{ recipeId: "r1", scale: 1 }, { recipeId: "r2", scale: 2 }]);
    expect(await getPlannedRecipeIds()).toEqual(["r1", "r2"]);
  });
});

describe("getMenuData", () => {
  it("merges plan scale + coverage with each recipe's title and optional ingredients", async () => {
    fetchQuery
      .mockResolvedValueOnce([{ recipeId: "r1", scale: 2 }]) // plan (getPlanData)
      .mockResolvedValueOnce([{ ingredientId: "beef", quantityG: 500, updatedAt: 1 }]); // pantry
    sanityFetch
      .mockResolvedValueOnce(REQS) // requirements (coverage)
      .mockResolvedValueOnce([
        { _id: "r1", title: "Beef Stew", slug: "beef-stew", coverImage: { asset: { _ref: "image-x" } }, prepTime: 10, cookTime: 25, servings: 4, optionalIngredients: [{ id: "herb", name: "herb" }] },
      ]); // MENU_RECIPES_QUERY

    const data = await getMenuData();
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      recipeId: "r1",
      scale: 2,
      title: "Beef Stew",
      slug: "beef-stew",
      coverImage: { asset: { _ref: "image-x" } },
      prepTime: 10,
      cookTime: 25,
      servings: 4,
      optionalIngredients: [{ id: "herb", name: "herb" }],
    });
    expect(data[0].coverage).toHaveProperty("missingRequired");
  });

  it("returns an empty array when nothing is planned", async () => {
    fetchQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([]); // plan, pantry
    expect(await getMenuData()).toEqual([]);
  });
});
