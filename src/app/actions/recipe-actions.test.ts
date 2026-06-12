import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireMember } from "@/lib/viewer";
import { editRecipeText, deleteRecipe } from "@/app/actions/recipe-actions";

vi.mock("@/lib/viewer", () => ({ requireMember: vi.fn() }));
vi.mock("@/sanity/lib/write-client", () => ({ getWriteClient: vi.fn(() => ({})) }));
vi.mock("@/sanity/lib/client", () => ({
  client: { withConfig: () => ({ fetch: vi.fn().mockResolvedValue(null) }) },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockRequireMember = vi.mocked(requireMember);

beforeEach(() => {
  mockRequireMember.mockReset();
  mockRequireMember.mockResolvedValue({ userId: "u1", householdId: "h1" });
});

describe("recipe action guards", () => {
  it("editRecipeText requires a title", async () => {
    const res = await editRecipeText("r1", new FormData());
    expect(res).toEqual({ ok: false, error: "Title is required" });
  });

  it("editRecipeText propagates the authorization error for non-members", async () => {
    mockRequireMember.mockRejectedValue(new Error("Not authorized: household members only"));
    const fd = new FormData();
    fd.set("title", "X");
    await expect(editRecipeText("r1", fd)).rejects.toThrow("Not authorized");
    await expect(deleteRecipe("r1")).rejects.toThrow("Not authorized");
  });

  it("deleteRecipe refuses a target that is not a recipe", async () => {
    // client.fetch resolves null in this suite, so assertRecipe sees no recipe.
    await expect(deleteRecipe("not-a-recipe")).rejects.toThrow(
      "Target document is not a recipe",
    );
  });
});
