import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/viewer", () => ({ requireMember: vi.fn() }));
vi.mock("@convex-dev/auth/nextjs/server", () => ({
  convexAuthNextjsToken: vi.fn().mockResolvedValue("tok"),
}));
const fetchMutation = vi.fn().mockResolvedValue(undefined);
vi.mock("convex/nextjs", () => ({ fetchMutation: (...a: unknown[]) => fetchMutation(...a) }));
const sanityFetch = vi.fn();
vi.mock("@/sanity/lib/client", () => ({
  client: { withConfig: () => ({ fetch: (...a: unknown[]) => sanityFetch(...a) }) },
}));
const importRecipeBlurb = vi.fn();
vi.mock("@/lib/import/client", () => ({ importRecipeBlurb: (...a: unknown[]) => importRecipeBlurb(...a) }));

import { requireMember } from "@/lib/viewer";
import { importRecipe } from "@/app/actions/import-actions";

const RAW = {
  title: "Chili", description: "Hot.", servings: 2, candidateTags: ["dinner"], steps: ["Cook."],
  ingredients: [
    { name: "ground beef", quantity: "1", unit: "lb", optional: false, per100g: { calories: 215, protein: 18, carbs: 0, fat: 15 } },
    { name: "cilantro", quantity: "10", unit: "g", optional: true, per100g: { calories: 23, protein: 2, carbs: 4, fat: 0 } },
  ],
};

beforeEach(() => {
  vi.mocked(requireMember).mockResolvedValue({ userId: "u1", householdId: "h1" });
  fetchMutation.mockClear();
  sanityFetch.mockReset();
  importRecipeBlurb.mockReset();
});

describe("importRecipe", () => {
  it("rate-limits, calls Claude, resolves catalog matches, returns a draft", async () => {
    importRecipeBlurb.mockResolvedValueOnce(RAW);
    sanityFetch.mockResolvedValueOnce([{ _id: "beef-id", name: "ground beef" }]);

    const res = await importRecipe("Grandma's chili");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.draft.title).toBe("Chili");
      const beef = res.draft.ingredients.find((i) => i.name === "ground beef");
      expect(beef).toMatchObject({ catalogId: "beef-id", isNew: false });
      const herb = res.draft.ingredients.find((i) => i.name === "cilantro");
      expect(herb).toMatchObject({ catalogId: null, isNew: true });
      expect(res.draft.macros.full.calories).toBeGreaterThan(0);
    }
    expect(fetchMutation).toHaveBeenCalled();
  });

  it("returns an error result when Claude output is invalid (no publish path hit)", async () => {
    importRecipeBlurb.mockResolvedValueOnce({ title: "", ingredients: [] });
    const res = await importRecipe("garbage");
    expect(res.ok).toBe(false);
  });

  it("propagates the rate-limit rejection", async () => {
    fetchMutation.mockRejectedValueOnce(new Error("Daily import limit reached."));
    await expect(importRecipe("x")).rejects.toThrow(/limit/i);
  });

  it("rejects a non-member", async () => {
    vi.mocked(requireMember).mockRejectedValueOnce(new Error("Not authorized"));
    await expect(importRecipe("x")).rejects.toThrow(/authorized/i);
  });
});
