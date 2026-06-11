import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireMember, getViewer } from "@/lib/viewer";
import { getWriteClient } from "@/sanity/lib/write-client";
import {
  markMade,
  saveRecipe,
  addNote,
  deleteRecipe,
  unmarkMade,
} from "@/app/actions/recipe-actions";

vi.mock("@/lib/viewer", () => ({
  requireMember: vi.fn(),
  getViewer: vi.fn(),
}));
vi.mock("@/sanity/lib/write-client", () => ({ getWriteClient: vi.fn(() => ({})) }));
vi.mock("@/sanity/lib/client", () => ({
  client: { withConfig: () => ({ fetch: vi.fn().mockResolvedValue(null) }) },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockRequireMember = vi.mocked(requireMember);
const mockGetViewer = vi.mocked(getViewer);

const MEMBER_VIEWER = {
  isAuthenticated: true,
  isMember: true,
  userId: "u1",
  householdId: "h1",
  role: "owner" as const,
  name: "Jacob",
};

beforeEach(() => {
  mockRequireMember.mockReset();
  mockRequireMember.mockResolvedValue({ userId: "u1", householdId: "h1" });
  mockGetViewer.mockReset();
  mockGetViewer.mockResolvedValue(MEMBER_VIEWER);
});

describe("recipe action guards", () => {
  it("markMade rejects an invalid timestamp", async () => {
    await expect(markMade("r1", "not-a-date")).rejects.toThrow("Invalid timestamp");
  });

  it("saveRecipe requires a title", async () => {
    const res = await saveRecipe(null, new FormData());
    expect(res).toEqual({ ok: false, error: "Title is required" });
  });

  it("propagates the authorization error for non-members", async () => {
    mockRequireMember.mockRejectedValue(
      new Error("Not authorized: household members only"),
    );
    await expect(markMade("r1", new Date().toISOString())).rejects.toThrow(
      "Not authorized",
    );
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

  it("addNote refuses a non-member", async () => {
    mockGetViewer.mockResolvedValue({ ...MEMBER_VIEWER, isMember: false });
    expect(await addNote("r1", "looks good")).toEqual({
      ok: false,
      error: "Not authorized",
    });
  });

  it("deleteRecipe propagates the authorization error for non-members", async () => {
    mockRequireMember.mockRejectedValue(
      new Error("Not authorized: household members only"),
    );
    await expect(deleteRecipe("r1")).rejects.toThrow("Not authorized");
  });

  it("deleteRecipe refuses a target that is not a recipe", async () => {
    // client.fetch resolves null in this suite, so assertRecipe sees no recipe.
    await expect(deleteRecipe("not-a-recipe")).rejects.toThrow(
      "Target document is not a recipe",
    );
  });

  it("unmarkMade propagates the authorization error for non-members", async () => {
    mockRequireMember.mockRejectedValue(
      new Error("Not authorized: household members only"),
    );
    await expect(unmarkMade("r1")).rejects.toThrow("Not authorized");
  });
});

describe("saveRecipe ingredient persistence", () => {
  // Capture the recipe document handed to write.create / write.patch so we can
  // assert which ingredient fields survive a save.
  function captureWriteClient() {
    const created: Record<string, unknown>[] = [];
    const fakeWrite = {
      create: vi.fn(async (doc: Record<string, unknown>) => {
        created.push(doc);
        return { _id: doc._type === "ingredient" ? `ing-${doc.name}` : "recipe-1" };
      }),
      patch: vi.fn(() => ({
        set: () => ({ commit: vi.fn().mockResolvedValue(undefined) }),
      })),
      assets: { upload: vi.fn() },
    };
    vi.mocked(getWriteClient).mockReturnValue(
      fakeWrite as unknown as ReturnType<typeof getWriteClient>,
    );
    return created;
  }

  // The save path builds `doc.ingredients` from parallel form arrays via one
  // shared loop used by both create and edit, so the create case locks in the
  // fields that must survive a save — note included (it was previously dropped,
  // wiping notes whenever a recipe was edited).
  it("keeps each ingredient's note, optional flag, quantity, and unit", async () => {
    const created = captureWriteClient();
    const fd = new FormData();
    fd.set("title", "Test Recipe");
    fd.append("step", "Mix and cook");
    fd.append("ingQty", "2");
    fd.append("ingUnit", "cup");
    fd.append("ingName", "flour");
    fd.append("ingNote", "sifted");
    fd.append("ingOptional", "true");

    const res = await saveRecipe(null, fd);
    expect(res.ok).toBe(true);

    const recipe = created.find((d) => d._type === "recipe");
    const line = (recipe?.ingredients as Record<string, unknown>[])[0];
    expect(line.note).toBe("sifted");
    expect(line.optional).toBe(true);
    expect(line.quantity).toBe("2");
    expect(line.unit).toBe("cup");
  });
});
