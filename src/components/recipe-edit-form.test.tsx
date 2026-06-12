import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const editRecipeText = vi.fn();
vi.mock("@/app/actions/recipe-actions", () => ({ editRecipeText: (...a: unknown[]) => editRecipeText(...a) }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { RecipeEditForm } from "@/components/recipe-edit-form";
import type { RecipeEditData } from "@/sanity/types";

const RECIPE: RecipeEditData = {
  _id: "rec-1", title: "Chili", slug: "chili", description: "Hot.",
  prepTime: 10, cookTime: 30, servings: 4,
  ingredients: [{ _key: "k", quantity: "1", unit: "lb", name: "beef", ingredientId: "beef-id", optional: false }],
  steps: ["Brown.", "Simmer."], tagIds: ["t1"], hasImage: true,
};
const TAGS = [{ _id: "t1", name: "dinner" }, { _id: "t2", name: "spicy" }];

beforeEach(() => {
  editRecipeText.mockReset().mockResolvedValue({ ok: true, slug: "chili" });
  push.mockReset();
});

describe("RecipeEditForm", () => {
  it("renders the text fields and a Re-import link (no ingredient editing)", () => {
    render(<RecipeEditForm recipe={RECIPE} tags={TAGS} />);
    expect(screen.getByDisplayValue("Chili")).toBeInTheDocument();
    expect(screen.getByLabelText("Step 1")).toHaveValue("Brown.");
    expect(screen.getByRole("link", { name: /Re-import/ })).toHaveAttribute("href", "/submit?reimport=rec-1");
    // no ingredient quantity inputs
    expect(screen.queryByLabelText(/Quantity for/)).not.toBeInTheDocument();
  });

  it("saves text edits via editRecipeText and routes to the recipe", async () => {
    const user = userEvent.setup();
    render(<RecipeEditForm recipe={RECIPE} tags={TAGS} />);
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(editRecipeText).toHaveBeenCalledWith("rec-1", expect.any(FormData));
    expect(push).toHaveBeenCalledWith("/recipe/chili");
  });
});
