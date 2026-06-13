import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/app/actions/recipe-actions", () => ({ deleteRecipe: vi.fn() }));

import { RecipeActionsMenu } from "@/components/recipe-actions-menu";

describe("RecipeActionsMenu", () => {
  it("hides Edit/Share/Delete behind the overflow button", async () => {
    const user = userEvent.setup();
    render(<RecipeActionsMenu slug="tacos" recipeId="r1" title="Tacos" />);
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/recipe/tacos/edit");
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("toggles closed again", async () => {
    const user = userEvent.setup();
    render(<RecipeActionsMenu slug="tacos" recipeId="r1" title="Tacos" />);
    const more = screen.getByRole("button", { name: "More actions" });
    await user.click(more);
    await user.click(more);
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
  });
});
