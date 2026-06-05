import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireEditor } from "@/lib/viewer";
import {
  rateRecipe,
  markMade,
  saveRecipe,
  addNote,
  deleteRecipe,
  unmarkMade,
} from "@/app/actions/recipe-actions";

vi.mock("@/lib/viewer", () => ({ requireEditor: vi.fn() }));
vi.mock("@/sanity/lib/write-client", () => ({ getWriteClient: vi.fn(() => ({})) }));
vi.mock("@/sanity/lib/client", () => ({
  client: { withConfig: () => ({ fetch: vi.fn().mockResolvedValue(null) }) },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockRequireEditor = vi.mocked(requireEditor);

beforeEach(() => {
  mockRequireEditor.mockReset();
  mockRequireEditor.mockResolvedValue({
    editorId: "e1",
    isEditor: true,
    name: "Jacob",
  });
});

describe("recipe action guards", () => {
  it("rateRecipe rejects out-of-range values", async () => {
    await expect(rateRecipe("r1", 6)).rejects.toThrow("Rating must be 0–5");
    await expect(rateRecipe("r1", -1)).rejects.toThrow("Rating must be 0–5");
  });

  it("markMade rejects an invalid timestamp", async () => {
    await expect(markMade("r1", "not-a-date")).rejects.toThrow("Invalid timestamp");
  });

  it("saveRecipe requires a title", async () => {
    const res = await saveRecipe(null, new FormData());
    expect(res).toEqual({ ok: false, error: "Title is required" });
  });

  it("propagates the authorization error for non-editors", async () => {
    mockRequireEditor.mockRejectedValue(new Error("Not authorized: editors only"));
    await expect(rateRecipe("r1", 4)).rejects.toThrow("Not authorized");
    await expect(saveRecipe(null, new FormData())).rejects.toThrow("Not authorized");
  });

  it("addNote rejects empty and over-long notes", async () => {
    expect(await addNote("r1", "   ")).toEqual({ ok: false, error: "Note is empty" });
    const longNote = "x".repeat(501);
    expect(await addNote("r1", longNote)).toEqual({
      ok: false,
      error: "Note too long (max 500)",
    });
  });

  it("addNote propagates the authorization error for non-editors", async () => {
    mockRequireEditor.mockRejectedValue(new Error("Not authorized: editors only"));
    await expect(addNote("r1", "looks good")).rejects.toThrow("Not authorized");
  });

  it("deleteRecipe propagates the authorization error for non-editors", async () => {
    mockRequireEditor.mockRejectedValue(new Error("Not authorized: editors only"));
    await expect(deleteRecipe("r1")).rejects.toThrow("Not authorized");
  });

  it("deleteRecipe refuses a target that is not a recipe", async () => {
    // client.fetch resolves null in this suite, so assertRecipe sees no recipe.
    await expect(deleteRecipe("not-a-recipe")).rejects.toThrow(
      "Target document is not a recipe",
    );
  });

  it("unmarkMade propagates the authorization error for non-editors", async () => {
    mockRequireEditor.mockRejectedValue(new Error("Not authorized: editors only"));
    await expect(unmarkMade("r1")).rejects.toThrow("Not authorized");
  });
});
