import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/viewer", () => ({ getViewer: vi.fn() }));
vi.mock("@convex-dev/auth/nextjs/server", () => ({
  convexAuthNextjsToken: vi.fn().mockResolvedValue("tok"),
}));
const fetchMutation = vi.fn().mockResolvedValue(undefined);
vi.mock("convex/nextjs", () => ({ fetchMutation: (...a: unknown[]) => fetchMutation(...a) }));
const sanityFetch = vi.fn();
vi.mock("@/sanity/lib/client", () => ({
  client: { withConfig: () => ({ fetch: (...a: unknown[]) => sanityFetch(...a) }) },
}));

import { getViewer } from "@/lib/viewer";
import { api } from "@cvx/_generated/api";
import { runPantryMigration, correctPantryQuantity } from "@/app/actions/migrate-actions";

const OWNER = { isAuthenticated: true, isMember: true, userId: "u1", householdId: "h1", role: "owner", name: "F", canCreateHousehold: false };

beforeEach(() => {
  vi.mocked(getViewer).mockResolvedValue(OWNER as never);
  fetchMutation.mockClear();
  sanityFetch.mockReset();
});

function mockSanity() {
  sanityFetch.mockImplementation((q: unknown, params: unknown) => {
    const p = params as { ids?: string[] } | undefined;
    if (p?.ids) {
      // INGREDIENTS_BY_IDS_QUERY — metadata for the pantry id set
      return Promise.resolve([
        { ingredientId: "beef", name: "ground beef", canonicalUnitKind: "mass",
          density: null, avgUnitGrams: null, category: "protein", restockQuantity: { quantity: 1, unit: "kg" } },
        { ingredientId: "egg", name: "egg", canonicalUnitKind: "count",
          density: null, avgUnitGrams: 50, category: "produce", restockQuantity: { quantity: 12, unit: "" } },
      ]);
    }
    if (q && String(q).includes("mealPlan")) {
      return Promise.resolve({
        recipeIds: ["r1"],
        recipeScales: [{ recipeId: "r1", scale: 2 }],
        pantryIngredients: ["beef"],
        manualItems: [
          { name: "eggs", location: "pantry" },
          { name: "grandma sauce", location: "pantry" },
        ],
      });
    }
    // INGREDIENT_NAMES_QUERY
    return Promise.resolve([{ ingredientId: "egg", name: "egg" }]);
  });
}

describe("runPantryMigration", () => {
  it("rejects a non-owner", async () => {
    vi.mocked(getViewer).mockResolvedValue({ ...OWNER, role: "member" } as never);
    await expect(runPantryMigration()).rejects.toThrow(/owner/i);
  });

  it("seeds plan + pantry (old set + pantry-location manual), reports unmapped", async () => {
    mockSanity();
    const review = await runPantryMigration();

    expect(fetchMutation).toHaveBeenCalledWith(api.plan.addToPlan, { recipeId: "r1", scale: 2 }, { token: "tok" });
    // pantry seeded from BOTH the old id-set (beef) and the matched pantry-location manual (eggs→egg)
    expect(fetchMutation).toHaveBeenCalledWith(api.pantry.setPantryQuantity, { ingredientId: "beef", quantityG: 1000 }, { token: "tok" });
    expect(fetchMutation).toHaveBeenCalledWith(api.pantry.setPantryQuantity, { ingredientId: "egg", quantityG: 12 }, { token: "tok" });

    expect(review.seededPlan).toEqual([{ recipeId: "r1", scale: 2 }]);
    expect(review.seededPantry.map((p) => p.ingredientId).sort()).toEqual(["beef", "egg"]);
    expect(review.unmappedManual).toEqual(["grandma sauce"]);
    expect(review.groceryAdded).toEqual([]);
  });
});

describe("correctPantryQuantity", () => {
  it("rejects a non-owner", async () => {
    vi.mocked(getViewer).mockResolvedValue({ ...OWNER, role: "member" } as never);
    await expect(correctPantryQuantity("beef", 500)).rejects.toThrow(/owner/i);
  });

  it("rejects a negative quantity without calling the mutation", async () => {
    const res = await correctPantryQuantity("beef", -5);
    expect(res.ok).toBe(false);
    expect(fetchMutation).not.toHaveBeenCalled();
  });

  it("sets the absolute pantry quantity under the owner token", async () => {
    const res = await correctPantryQuantity("beef", 750);
    expect(res.ok).toBe(true);
    expect(fetchMutation).toHaveBeenCalledWith(
      api.pantry.setPantryQuantity,
      { ingredientId: "beef", quantityG: 750 },
      { token: "tok" },
    );
  });
});
