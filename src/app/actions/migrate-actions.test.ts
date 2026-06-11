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
import { runPantryMigration } from "@/app/actions/migrate-actions";

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
      // INGREDIENTS_BY_IDS_QUERY
      return Promise.resolve([
        { ingredientId: "beef", name: "ground beef", canonicalUnitKind: "mass",
          density: null, avgUnitGrams: null, category: "protein", restockQuantity: { quantity: 1, unit: "kg" } },
      ]);
    }
    if (q && String(q).includes("mealPlan")) {
      return Promise.resolve({
        recipeIds: ["r1"],
        recipeScales: [{ recipeId: "r1", scale: 2 }],
        pantryIngredients: ["beef"],
        manualItems: [{ name: "paper towels" }, { name: "grandma sauce" }],
      });
    }
    // INGREDIENT_NAMES_QUERY
    return Promise.resolve([{ ingredientId: "pt", name: "Paper Towels" }]);
  });
}

describe("runPantryMigration", () => {
  it("rejects a non-owner", async () => {
    vi.mocked(getViewer).mockResolvedValue({ ...OWNER, role: "member" } as never);
    await expect(runPantryMigration()).rejects.toThrow(/owner/i);
  });

  it("seeds plan + pantry + matched manual and returns a review list", async () => {
    mockSanity();
    const review = await runPantryMigration();

    expect(fetchMutation).toHaveBeenCalledWith(api.plan.addToPlan, { recipeId: "r1", scale: 2 }, { token: "tok" });
    expect(fetchMutation).toHaveBeenCalledWith(api.pantry.setPantryQuantity, { ingredientId: "beef", quantityG: 1000 }, { token: "tok" });
    expect(fetchMutation).toHaveBeenCalledWith(api.grocery.addManualItem, { ingredientId: "pt" }, { token: "tok" });

    expect(review.seededPlan).toEqual([{ recipeId: "r1", scale: 2 }]);
    expect(review.seededPantry).toEqual([
      { ingredientId: "beef", name: "ground beef", quantityG: 1000, canonicalUnitKind: "mass" },
    ]);
    expect(review.unmappedManual).toEqual(["grandma sauce"]);
    expect(review.skippedPantry).toEqual([]);
  });
});
