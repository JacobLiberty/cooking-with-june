import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireEditor } from "@/lib/viewer";
import {
  addToPlan,
  removeFromPlan,
  checkGroceryIngredient,
  skipGroceryIngredient,
  removePantryIngredient,
  movePantryIngredientToGrocery,
  addManualItem,
  setManualLocation,
  removeManualItem,
} from "@/app/actions/plan-actions";

const chain: Record<string, unknown> = {};
["setIfMissing", "append", "set", "unset", "patch"].forEach((m) => {
  chain[m] = vi.fn(() => chain);
});
(chain as { commit: unknown }).commit = vi.fn().mockResolvedValue({});

vi.mock("@/lib/viewer", () => ({ requireEditor: vi.fn() }));
vi.mock("@/sanity/lib/write-client", () => ({
  getWriteClient: vi.fn(() => ({
    createIfNotExists: vi.fn().mockResolvedValue({}),
    patch: vi.fn(() => chain),
  })),
}));
vi.mock("@/sanity/lib/client", () => ({
  client: { withConfig: () => ({ fetch: vi.fn().mockResolvedValue(null) }) },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockRequireEditor = vi.mocked(requireEditor);

beforeEach(() => {
  mockRequireEditor.mockReset();
  mockRequireEditor.mockResolvedValue({ editorId: "e1", isEditor: true, name: "Jacob" });
});

describe("plan action guards", () => {
  it("rejects empty / over-long manual items", async () => {
    expect(await addManualItem("   ", "k1")).toEqual({
      ok: false,
      error: "Item is empty",
    });
    expect(await addManualItem("x".repeat(121), "k2")).toEqual({
      ok: false,
      error: "Too long (max 120)",
    });
  });

  it("rejects an invalid manual-item location", async () => {
    await expect(
      // @ts-expect-error — exercising the runtime guard with a bad value
      setManualLocation("k1", "freezer"),
    ).rejects.toThrow("Invalid location");
  });

  it("propagates the authorization error for non-editors", async () => {
    mockRequireEditor.mockRejectedValue(new Error("Not authorized: editors only"));
    await expect(addToPlan("r1")).rejects.toThrow("Not authorized");
    await expect(checkGroceryIngredient("i1")).rejects.toThrow("Not authorized");
    await expect(skipGroceryIngredient("i1")).rejects.toThrow("Not authorized");
    await expect(addManualItem("milk", "k1")).rejects.toThrow("Not authorized");
  });

  it("rejects ids that could inject into a patch path", async () => {
    const evil = 'x" || true || "';
    await expect(removeFromPlan(evil)).rejects.toThrow("Invalid id");
    await expect(checkGroceryIngredient(evil)).rejects.toThrow("Invalid id");
    await expect(skipGroceryIngredient(evil)).rejects.toThrow("Invalid id");
    await expect(removePantryIngredient(evil)).rejects.toThrow("Invalid id");
    await expect(movePantryIngredientToGrocery(evil)).rejects.toThrow("Invalid id");
    await expect(setManualLocation(evil, "pantry")).rejects.toThrow("Invalid id");
    await expect(removeManualItem(evil)).rejects.toThrow("Invalid id");
    await expect(addManualItem("milk", evil)).rejects.toThrow("Invalid id");
  });
});
