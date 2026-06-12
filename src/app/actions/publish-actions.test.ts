import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/viewer", () => ({ requireMember: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const create = vi.fn().mockResolvedValue({ _id: "new-recipe-id" });
const patch = vi.fn(() => ({ set: () => ({ commit: vi.fn().mockResolvedValue({}) }) }));
vi.mock("@/sanity/lib/write-client", () => ({
  getWriteClient: () => ({ create: (...a: unknown[]) => create(...a), patch }),
}));
const sanityFetch = vi.fn();
vi.mock("@/sanity/lib/client", () => ({
  client: { withConfig: () => ({ fetch: (...a: unknown[]) => sanityFetch(...a) }) },
}));
const getOrCreate = vi.fn();
vi.mock("@/lib/ingredients/get-or-create", () => ({
  getOrCreateEnrichedIngredient: (...a: unknown[]) => getOrCreate(...a),
}));
const generateRecipeCover = vi.fn();
vi.mock("@/lib/import/cover", () => ({ generateRecipeCover: (...a: unknown[]) => generateRecipeCover(...a) }));

import { requireMember } from "@/lib/viewer";
import { publishRecipe } from "@/app/actions/publish-actions";
import type { RecipeDraft } from "@/lib/import/types";

const DRAFT: RecipeDraft = {
  title: "Weeknight Chili",
  description: "A pot of chili.",
  servings: 2,
  candidateTags: ["dinner"],
  steps: ["Brown the beef.", "Simmer."],
  ingredients: [
    { name: "ground beef", quantity: "1", unit: "lb", optional: false, per100g: { calories: 215, protein: 18, carbs: 0, fat: 15 }, catalogId: "beef-id", isNew: false },
    { name: "cilantro", quantity: "10", unit: "g", optional: true, per100g: { calories: 23, protein: 2, carbs: 4, fat: 0 }, catalogId: null, isNew: true },
  ],
  macros: { base: { calories: 0, protein: 0, carbs: 0, fat: 0 }, full: { calories: 0, protein: 0, carbs: 0, fat: 0 }, estimated: true, unparsedLines: [] },
};

beforeEach(() => {
  vi.mocked(requireMember).mockResolvedValue({ userId: "u1", householdId: "h1" });
  create.mockClear().mockResolvedValue({ _id: "new-recipe-id" });
  sanityFetch.mockReset();
  getOrCreate.mockReset().mockImplementation(async (name: string) => `${name}-id`);
  generateRecipeCover.mockReset();
});

describe("publishRecipe", () => {
  it("resolves ingredients, recomputes macros, creates the recipe, fires cover", async () => {
    sanityFetch
      .mockResolvedValueOnce(["dinner-id"]) // tag ids by name
      .mockResolvedValueOnce([]); // taken slugs
    const res = await publishRecipe(DRAFT);
    expect(res.ok).toBe(true);
    expect(getOrCreate).toHaveBeenCalledWith("ground beef");
    expect(getOrCreate).toHaveBeenCalledWith("cilantro");
    const doc = create.mock.calls[0][0] as Record<string, any>;
    expect(doc._type).toBe("recipe");
    expect(doc.ingredients).toHaveLength(2);
    expect(doc.ingredients[0].ingredient._ref).toBe("ground beef-id");
    expect(doc.ingredients[1].optional).toBe(true);
    expect(doc.tags[0]._ref).toBe("dinner-id");
    // macros recomputed server-side from per100g (not the zeros in the draft)
    expect(doc.macros.full.calories).toBeGreaterThan(0);
    expect(doc.macros.estimated).toBe(true);
    expect(doc.slug.current).toBe("weeknight-chili");
    // cover fired with the new doc id (no manual upload)
    expect(generateRecipeCover).toHaveBeenCalledWith("new-recipe-id", "Weeknight Chili");
    if (res.ok) expect(res.slug).toBe("weeknight-chili");
  });

  it("rejects a non-member", async () => {
    vi.mocked(requireMember).mockRejectedValueOnce(new Error("Not authorized"));
    await expect(publishRecipe(DRAFT)).rejects.toThrow(/authorized/i);
  });

  it("rejects an empty title", async () => {
    const res = await publishRecipe({ ...DRAFT, title: "  " });
    expect(res.ok).toBe(false);
  });
});
