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
vi.mock("@/lib/ingredients/get-or-create", () => ({
  getOrCreateEnrichedIngredient: vi.fn().mockResolvedValue("ing-id"),
}));

import { requireMember } from "@/lib/viewer";
import { api } from "@cvx/_generated/api";
import { getOrCreateEnrichedIngredient } from "@/lib/ingredients/get-or-create";
import {
  addToPlan,
  cook,
  markBought,
  addShopItemByName,
  setBuyQuantity,
  depletePantryItem,
} from "@/app/actions/kitchen-actions";

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

describe("addShopItemByName", () => {
  it("resolves the name to a catalog id then adds a manual grocery row", async () => {
    vi.mocked(getOrCreateEnrichedIngredient).mockResolvedValueOnce("salt-id");
    const res = await addShopItemByName("Sea Salt");
    expect(getOrCreateEnrichedIngredient).toHaveBeenCalledWith("Sea Salt");
    expect(fetchMutation).toHaveBeenCalledWith(
      api.grocery.addManualItem,
      { ingredientId: "salt-id" },
      { token: "tok" },
    );
    expect(res).toEqual({ ingredientId: "salt-id" });
  });
});

describe("markBought", () => {
  it("markBought adds the buy quantity and removes the grocery row", async () => {
    await markBought("ing-1", 500);
    expect(fetchMutation).toHaveBeenCalledWith(
      api.pantry.adjustPantry, { ingredientId: "ing-1", deltaG: 500 }, expect.anything(),
    );
    expect(fetchMutation).toHaveBeenCalledWith(
      api.grocery.removeBought, { ingredientId: "ing-1" }, expect.anything(),
    );
  });

  it("markBought with null skips the pantry write but still clears the row", async () => {
    await markBought("ing-1", null);
    // api function refs are Convex Proxies that throw when pretty-formatted, so we
    // can't pass api.pantry.adjustPantry into .not.toHaveBeenCalledWith. Assert on
    // the recorded call args (a pantry-adjust call has a `deltaG` field) instead.
    const adjustCall = fetchMutation.mock.calls.find(
      (c) => c[1] != null && typeof c[1] === "object" && "deltaG" in (c[1] as object),
    );
    expect(adjustCall).toBeUndefined();
    expect(fetchMutation).toHaveBeenCalledWith(
      api.grocery.removeBought, { ingredientId: "ing-1" }, expect.anything(),
    );
  });

  it("markBought rejects a non-positive or fractional quantity", async () => {
    await expect(markBought("ing-1", 0)).rejects.toThrow();
    await expect(markBought("ing-1", 2.5)).rejects.toThrow();
  });
});

describe("setBuyQuantity", () => {
  it("setBuyQuantity forwards to the grocery mutation", async () => {
    await setBuyQuantity("ing-1", 473);
    expect(fetchMutation).toHaveBeenCalledWith(
      api.grocery.setBuyQuantity, { ingredientId: "ing-1", buyQuantityG: 473 }, expect.anything(),
    );
  });
});

describe("depletePantryItem", () => {
  it("depletePantryItem forwards to pantry.depleteItem", async () => {
    await depletePantryItem("ing-1");
    expect(fetchMutation).toHaveBeenCalledWith(
      api.pantry.depleteItem, { ingredientId: "ing-1" }, expect.anything(),
    );
  });
});
