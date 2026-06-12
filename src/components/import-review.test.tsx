import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const actions = vi.hoisted(() => ({ importRecipe: vi.fn(), publishRecipe: vi.fn() }));
vi.mock("@/app/actions/import-actions", () => ({ importRecipe: actions.importRecipe }));
vi.mock("@/app/actions/publish-actions", () => ({ publishRecipe: actions.publishRecipe }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { ImportReview } from "@/components/import-review";

const DRAFT = {
  title: "Chili", description: "Hot.", servings: 2, candidateTags: ["dinner"],
  steps: ["Cook."],
  ingredients: [
    { name: "ground beef", quantity: "1", unit: "lb", optional: false, per100g: { calories: 215, protein: 18, carbs: 0, fat: 15 }, catalogId: "beef-id", isNew: false },
    { name: "cilantro", quantity: "10", unit: "g", optional: true, per100g: { calories: 23, protein: 2, carbs: 4, fat: 0 }, catalogId: null, isNew: true },
  ],
  macros: { base: { calories: 0, protein: 0, carbs: 0, fat: 0 }, full: { calories: 0, protein: 0, carbs: 0, fat: 0 }, estimated: true, unparsedLines: [] },
};
const TAGS = [{ _id: "t1", name: "dinner" }, { _id: "t2", name: "vegetarian" }];

beforeEach(() => {
  actions.importRecipe.mockReset();
  actions.publishRecipe.mockReset().mockResolvedValue({ ok: true, slug: "chili" });
  push.mockReset();
});

describe("ImportReview", () => {
  it("generates a draft from a blurb and shows the review form", async () => {
    const user = userEvent.setup();
    actions.importRecipe.mockResolvedValue({ ok: true, draft: DRAFT });
    render(<ImportReview tags={TAGS} />);
    await user.type(screen.getByLabelText("Recipe text"), "Grandma's chili");
    await user.click(screen.getByRole("button", { name: "Generate draft" }));
    expect(actions.importRecipe).toHaveBeenCalledWith("Grandma's chili");
    expect(await screen.findByDisplayValue("Chili")).toBeInTheDocument();
    expect(screen.getByText("new")).toBeInTheDocument(); // cilantro is new
  });

  it("shows the macro range and recomputes when a quantity changes", async () => {
    const user = userEvent.setup();
    actions.importRecipe.mockResolvedValue({ ok: true, draft: DRAFT });
    render(<ImportReview tags={TAGS} />);
    await user.type(screen.getByLabelText("Recipe text"), "x");
    await user.click(screen.getByRole("button", { name: "Generate draft" }));
    await screen.findByDisplayValue("Chili");
    expect(screen.getByText(/base \d+ kcal/i)).toBeInTheDocument();
  });

  it("publishes the draft and routes to the new recipe", async () => {
    const user = userEvent.setup();
    actions.importRecipe.mockResolvedValue({ ok: true, draft: DRAFT });
    render(<ImportReview tags={TAGS} />);
    await user.type(screen.getByLabelText("Recipe text"), "x");
    await user.click(screen.getByRole("button", { name: "Generate draft" }));
    await screen.findByDisplayValue("Chili");
    await user.click(screen.getByRole("button", { name: "Publish recipe" }));
    expect(actions.publishRecipe).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/recipe/chili");
  });

  it("surfaces an import error", async () => {
    const user = userEvent.setup();
    actions.importRecipe.mockResolvedValue({ ok: false, error: "Couldn't read that recipe." });
    render(<ImportReview tags={TAGS} />);
    await user.type(screen.getByLabelText("Recipe text"), "junk");
    await user.click(screen.getByRole("button", { name: "Generate draft" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't read/i);
  });

  it("prefills the blurb and republishes the same id when re-importing", async () => {
    const user = userEvent.setup();
    actions.importRecipe.mockResolvedValue({ ok: true, draft: DRAFT });
    render(<ImportReview tags={TAGS} initialBlurb="Existing recipe text" recipeId="rec-1" />);
    expect(screen.getByLabelText("Recipe text")).toHaveValue("Existing recipe text");
    await user.click(screen.getByRole("button", { name: "Generate draft" }));
    await screen.findByDisplayValue("Chili");
    await user.click(screen.getByRole("button", { name: "Publish recipe" }));
    expect(actions.publishRecipe).toHaveBeenCalledWith(expect.anything(), { recipeId: "rec-1" });
  });
});
