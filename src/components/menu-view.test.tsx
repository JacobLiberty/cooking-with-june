import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const actions = vi.hoisted(() => ({
  setScale: vi.fn(),
  removeFromPlan: vi.fn(),
  cook: vi.fn(),
}));
vi.mock("@/app/actions/kitchen-actions", () => actions);
const toast = vi.fn();
vi.mock("@/components/toast", () => ({ useToast: () => toast }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refresh }) }));

import { MenuView } from "@/components/menu-view";
import type { MenuRow } from "@/components/menu-recipe-row";

const ROWS: MenuRow[] = [
  {
    recipeId: "r1",
    title: "Beef Stew",
    slug: "beef-stew",
    scale: 1,
    coverage: { cookable: false, missingRequired: 2 },
    optionalIngredients: [
      { id: "herb", name: "fresh herbs" },
      { id: "cream", name: "cream" },
    ],
  },
  {
    recipeId: "r2",
    title: "Toast",
    slug: "toast",
    scale: 1,
    coverage: { cookable: true, missingRequired: 0 },
    optionalIngredients: [],
  },
];

const rowFor = (title: string) => screen.getByText(title).closest("li") as HTMLElement;

beforeEach(() => {
  Object.values(actions).forEach((m) => m.mockReset().mockResolvedValue(undefined));
  refresh.mockReset();
  toast.mockReset();
});

describe("MenuView", () => {
  it("shows the empty state when nothing is planned", () => {
    render(<MenuView rows={[]} />);
    expect(screen.getByText(/nothing planned yet/i)).toBeInTheDocument();
  });

  it("renders the required-only missing badge", () => {
    render(<MenuView rows={ROWS} />);
    expect(within(rowFor("Beef Stew")).getByText("Missing 2")).toBeInTheDocument();
    expect(within(rowFor("Toast")).getByText("Ready to cook")).toBeInTheDocument();
  });

  it("increasing the scale calls setScale", async () => {
    const user = userEvent.setup();
    render(<MenuView rows={ROWS} />);
    await user.click(within(rowFor("Beef Stew")).getByLabelText("Increase servings for Beef Stew"));
    expect(actions.setScale).toHaveBeenCalledWith("r1", 2);
  });

  it("does not let the scale drop below 1", async () => {
    const user = userEvent.setup();
    render(<MenuView rows={ROWS} />);
    await user.click(within(rowFor("Beef Stew")).getByLabelText("Decrease servings for Beef Stew"));
    expect(actions.setScale).not.toHaveBeenCalled();
  });

  it("Remove calls removeFromPlan and drops the row", async () => {
    const user = userEvent.setup();
    render(<MenuView rows={ROWS} />);
    await user.click(within(rowFor("Beef Stew")).getByLabelText("Remove Beef Stew from the menu"));
    expect(actions.removeFromPlan).toHaveBeenCalledWith("r1");
    expect(screen.queryByText("Beef Stew")).not.toBeInTheDocument();
  });

  it("Made it with optionals cooks with the selected optional ids", async () => {
    const user = userEvent.setup();
    render(<MenuView rows={ROWS} />);
    const stew = rowFor("Beef Stew");
    await user.click(within(stew).getByRole("button", { name: "Made it" }));
    await user.click(within(stew).getByLabelText("Used cream"));
    await user.click(within(stew).getByRole("button", { name: "Confirm — made it" }));
    expect(actions.cook).toHaveBeenCalledWith("r1", ["cream"]);
  });

  it("Made it with no optionals cooks with an empty list", async () => {
    const user = userEvent.setup();
    render(<MenuView rows={ROWS} />);
    const toastRow = rowFor("Toast");
    await user.click(within(toastRow).getByRole("button", { name: "Made it" }));
    await user.click(within(toastRow).getByRole("button", { name: "Confirm — made it" }));
    expect(actions.cook).toHaveBeenCalledWith("r2", []);
  });

  it("does not toast and reverts the row when cook fails", async () => {
    const user = userEvent.setup();
    actions.cook.mockRejectedValueOnce(new Error("boom"));
    render(<MenuView rows={ROWS} />);
    const stew = rowFor("Beef Stew");
    await user.click(within(stew).getByRole("button", { name: "Made it" }));
    await user.click(within(stew).getByRole("button", { name: "Confirm — made it" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't save/i);
    expect(toast).not.toHaveBeenCalled();
    // optimistic removal rolled back — the row is visible again
    expect(screen.getByText("Beef Stew")).toBeInTheDocument();
  });
});
