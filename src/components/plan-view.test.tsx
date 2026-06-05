import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanView } from "@/components/plan-view";
import type { PlanRecipe } from "@/sanity/plan-types";

const actions = vi.hoisted(() => ({
  toggleIngredientGot: vi.fn(),
  skipIngredient: vi.fn(),
  unskipIngredient: vi.fn(),
  removeFromPlan: vi.fn(),
  addManualItem: vi.fn(),
  toggleManualItem: vi.fn(),
  deleteManualItem: vi.fn(),
  setAllGot: vi.fn(),
}));
vi.mock("@/app/actions/plan-actions", () => actions);

const recipes: PlanRecipe[] = [
  {
    _id: "r1",
    title: "Soup",
    slug: "soup",
    coverImage: null,
    ingredients: [{ ingredientId: "onion", name: "Onion", quantity: "1", unit: "" }],
  },
];

beforeEach(() => {
  Object.values(actions).forEach((fn) => fn.mockReset());
});

describe("PlanView optimistic UI", () => {
  it("optimistically moves an item to 'Got it' and persists in the background", async () => {
    actions.toggleIngredientGot.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <PlanView recipes={recipes} checkedIds={[]} removedIds={[]} manual={[]} />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Got Onion" }));

    expect(actions.toggleIngredientGot).toHaveBeenCalledWith("onion");
    // Now shown under "Got it" with an un-check affordance, no longer to-get.
    await screen.findByRole("checkbox", { name: "Un-check Onion" });
    expect(
      screen.queryByRole("checkbox", { name: "Got Onion" }),
    ).not.toBeInTheDocument();
  });

  it("rolls back and surfaces an error when the save fails", async () => {
    actions.toggleIngredientGot.mockRejectedValue(new Error("nope"));
    const user = userEvent.setup();
    render(
      <PlanView recipes={recipes} checkedIds={[]} removedIds={[]} manual={[]} />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Got Onion" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't save/i);
    // Reverted: the item is back in the to-get list, not in "Got it".
    expect(screen.getByRole("checkbox", { name: "Got Onion" })).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "Un-check Onion" }),
    ).not.toBeInTheDocument();
  });

  it("skips an item to 'Not getting' and can add it back", async () => {
    actions.skipIngredient.mockResolvedValue(undefined);
    actions.unskipIngredient.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <PlanView recipes={recipes} checkedIds={[]} removedIds={[]} manual={[]} />,
    );

    await user.click(screen.getByRole("button", { name: "Skip Onion" }));
    expect(actions.skipIngredient).toHaveBeenCalledWith("onion");
    expect(await screen.findByText("Not getting")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add back" }));
    expect(actions.unskipIngredient).toHaveBeenCalledWith("onion");
    await screen.findByRole("checkbox", { name: "Got Onion" });
  });
});
