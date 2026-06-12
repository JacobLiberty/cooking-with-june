import { describe, it, expect, vi, beforeEach } from "vitest";

const sanityFetch = vi.fn();
vi.mock("@/sanity/lib/client", () => ({
  client: { withConfig: () => ({ fetch: (...a: unknown[]) => sanityFetch(...a) }) },
}));
const create = vi.fn();
vi.mock("@/sanity/lib/write-client", () => ({
  getWriteClient: () => ({ create: (...a: unknown[]) => create(...a) }),
}));
const enrichBatch = vi.fn();
vi.mock("@/lib/enrichment/client", () => ({
  enrichBatch: (...a: unknown[]) => enrichBatch(...a),
}));

import { getOrCreateEnrichedIngredient } from "@/lib/ingredients/get-or-create";

beforeEach(() => {
  sanityFetch.mockReset();
  create.mockReset();
  enrichBatch.mockReset();
  create.mockResolvedValue({ _id: "new-id" });
});

describe("getOrCreateEnrichedIngredient", () => {
  it("returns the existing id without enriching when a name match exists", async () => {
    sanityFetch.mockResolvedValueOnce({ _id: "existing-id" });
    const id = await getOrCreateEnrichedIngredient("Ground Beef");
    expect(id).toBe("existing-id");
    expect(enrichBatch).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("enriches and creates with full stock metadata when missing", async () => {
    sanityFetch.mockResolvedValueOnce(null);
    enrichBatch.mockResolvedValueOnce([
      {
        name: "havarti",
        canonicalUnitKind: "mass",
        category: "dairy",
        restockQuantity: { quantity: 200, unit: "g" },
      },
    ]);
    const id = await getOrCreateEnrichedIngredient("Havarti");
    expect(id).toBe("new-id");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        _type: "ingredient",
        name: "Havarti",
        canonicalUnitKind: "mass",
        category: "dairy",
        restockQuantity: { quantity: 200, unit: "g" },
      }),
    );
  });

  it("creates a minimal (flagged) ingredient when enrichment throws", async () => {
    sanityFetch.mockResolvedValueOnce(null);
    enrichBatch.mockRejectedValueOnce(new Error("api down"));
    const id = await getOrCreateEnrichedIngredient("Mystery Item");
    expect(id).toBe("new-id");
    const doc = create.mock.calls[0][0] as Record<string, unknown>;
    expect(doc._type).toBe("ingredient");
    expect(doc.name).toBe("Mystery Item");
    // No category/restock → the batch enrich script will pick it up later.
    expect(doc.category).toBeUndefined();
  });

  it("rejects an empty name", async () => {
    await expect(getOrCreateEnrichedIngredient("  ")).rejects.toThrow("Ingredient name required");
  });
});
