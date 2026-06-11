import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/viewer", () => ({ requireMember: vi.fn() }));
vi.mock("@convex-dev/auth/nextjs/server", () => ({
  convexAuthNextjsToken: vi.fn().mockResolvedValue("tok"),
}));
const fetchMutation = vi.fn().mockResolvedValue(undefined);
const fetchQuery = vi.fn();
vi.mock("convex/nextjs", () => ({
  fetchMutation: (...a: unknown[]) => fetchMutation(...a),
  fetchQuery: (...a: unknown[]) => fetchQuery(...a),
}));
const sanityFetch = vi.fn();
vi.mock("@/sanity/lib/client", () => ({
  client: { withConfig: () => ({ fetch: (...a: unknown[]) => sanityFetch(...a) }) },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { requireMember } from "@/lib/viewer";
import { api } from "@cvx/_generated/api";
import { addToPlan, cook, markBought } from "@/app/actions/kitchen-actions";

beforeEach(() => {
  vi.mocked(requireMember).mockResolvedValue({ userId: "u1", householdId: "h1" });
  fetchMutation.mockClear();
  fetchQuery.mockReset();
  sanityFetch.mockReset();
  // default: reconcile fetches return empty
  fetchQuery.mockResolvedValue([]);
});

describe("addToPlan", () => {
  it("calls the plan mutation with the scale and token", async () => {
    await addToPlan("r1", 2);
    expect(fetchMutation).toHaveBeenCalledWith(
      api.plan.addToPlan,
      { recipeId: "r1", scale: 2 },
      { token: "tok" },
    );
  });
});

describe("cook", () => {
  it("computes depletion deltas from the recipe + scale and calls cook", async () => {
    // api function references are Convex Proxies (new object per access) so we can't
    // use reference equality in mockImplementation. Use sequential mockResolvedValueOnce:
    // cook() calls: plan (for scale)
    // reconcileSkips() calls: plan, pantry, grocery (all return [] → no skips → early return)
    fetchQuery
      .mockResolvedValueOnce([{ recipeId: "r1", scale: 2 }]) // plan (scale lookup)
      .mockResolvedValueOnce([]) // reconcile: plan
      .mockResolvedValueOnce([]) // reconcile: pantry
      .mockResolvedValueOnce([]); // reconcile: grocery
    // cook() sanity fetch: RECIPE_REQUIREMENTS_QUERY
    // reconcileSkips sanity fetch: skips.length === 0 → no Sanity fetch needed
    sanityFetch.mockResolvedValueOnce([
      {
        _id: "r1",
        servings: 2,
        lines: [
          { ingredientId: "beef", name: "beef", quantity: "1", unit: "lb", optional: false,
            canonicalUnitKind: "mass", density: null, avgUnitGrams: null, category: "protein", restockQuantity: null },
          { ingredientId: "egg", name: "egg", quantity: "2", unit: "", optional: true,
            canonicalUnitKind: "count", density: null, avgUnitGrams: 50, category: "produce", restockQuantity: null },
        ],
      },
    ]);

    await cook("r1", ["egg"]);

    // api function references are Convex Proxy objects; compare the plain args instead.
    // Find the cook mutation call by its distinctive recipeId arg shape.
    const cookCall = fetchMutation.mock.calls.find(
      (c) => c[1] != null && typeof c[1] === "object" && (c[1] as Record<string, unknown>).recipeId === "r1" && "deltas" in (c[1] as object),
    );
    expect(cookCall).toBeTruthy();
    const args = cookCall![1] as { recipeId: string; deltas: { ingredientId: string; subtract: number }[] };
    expect(args.recipeId).toBe("r1");
    const beef = args.deltas.find((d) => d.ingredientId === "beef");
    const egg = args.deltas.find((d) => d.ingredientId === "egg");
    expect(beef?.subtract).toBeCloseTo(2 * 453.6);
    expect(egg?.subtract).toBe(4);
  });
});

describe("markBought", () => {
  it("adds the catalog restock amount to the pantry and removes the manual row", async () => {
    fetchQuery.mockResolvedValue([]); // pantry (no override) + reconcile fetches
    sanityFetch.mockImplementation((q: unknown, params: unknown) => {
      // INGREDIENT_RESTOCK_QUERY returns a single doc; RECIPE_REQUIREMENTS returns []
      if (params && (params as { id?: string }).id === "beef") {
        return Promise.resolve({
          _id: "beef", name: "beef",
          canonicalUnitKind: "mass", density: null, avgUnitGrams: null, category: "protein",
          restockQuantity: { quantity: 1, unit: "kg" },
        });
      }
      return Promise.resolve([]);
    });

    await markBought("beef");

    expect(fetchMutation).toHaveBeenCalledWith(
      api.pantry.adjustPantry,
      { ingredientId: "beef", deltaG: 1000 },
      { token: "tok" },
    );
    expect(fetchMutation).toHaveBeenCalledWith(
      api.grocery.removeManualItem,
      { ingredientId: "beef" },
      { token: "tok" },
    );
  });
});
