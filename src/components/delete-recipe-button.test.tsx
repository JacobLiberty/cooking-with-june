import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteRecipeButton } from "@/components/delete-recipe-button";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const deleteRecipe = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/recipe-actions", () => ({ deleteRecipe }));

beforeEach(() => {
  push.mockReset();
  deleteRecipe.mockReset();
});

describe("DeleteRecipeButton", () => {
  it("requires a second confirming click before deleting", async () => {
    const user = userEvent.setup();
    render(<DeleteRecipeButton recipeId="r1" title="Soup" />);

    // First click only reveals the confirm step — no delete yet.
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(deleteRecipe).not.toHaveBeenCalled();
    expect(screen.getByText("Delete this recipe?")).toBeInTheDocument();

    // Confirm fires the action and returns home on success.
    deleteRecipe.mockResolvedValue({ ok: true });
    await user.click(screen.getByRole("button", { name: "Delete Soup" }));
    expect(deleteRecipe).toHaveBeenCalledWith("r1");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("cancels back to the resting state without deleting", async () => {
    const user = userEvent.setup();
    render(<DeleteRecipeButton recipeId="r1" title="Soup" />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(deleteRecipe).not.toHaveBeenCalled();
    expect(screen.queryByText("Delete this recipe?")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("surfaces an error and stays on the page when the delete fails", async () => {
    const user = userEvent.setup();
    deleteRecipe.mockResolvedValue({ ok: false, error: "Nope" });
    render(<DeleteRecipeButton recipeId="r1" title="Soup" />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete Soup" }));

    expect(await screen.findByText("Nope")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
