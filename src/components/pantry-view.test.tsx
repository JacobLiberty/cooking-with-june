import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const actions = vi.hoisted(() => ({
  setPantryQuantity: vi.fn(),
  addManualItem: vi.fn(),
  depletePantryItem: vi.fn(),
}));
const toastSpy = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/kitchen-actions", () => actions);
vi.mock("@/components/toast", () => ({ useToast: () => toastSpy }));

import { PantryView } from "@/components/pantry-view";
import type { PantryRowData } from "@/components/pantry-row";

const ROWS: PantryRowData[] = [
  { ingredientId: "oil", name: "olive oil", quantityG: 740, canonicalUnitKind: "mass", category: "pantry", onList: false },
  { ingredientId: "garlic", name: "garlic", quantityG: 3, canonicalUnitKind: "count", category: "produce", onList: false },
  { ingredientId: "milk", name: "milk", quantityG: 500, canonicalUnitKind: "mass", category: "dairy", onList: true },
];

beforeEach(() => {
  Object.values(actions).forEach((m) => m.mockReset().mockResolvedValue(undefined));
  toastSpy.mockReset();
});

describe("PantryView", () => {
  it("groups rows by category in aisle order", () => {
    render(<PantryView rows={ROWS} />);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Produce", "Dairy", "Pantry"]);
  });

  it("nudging commits a whole-number quantity", async () => {
    const user = userEvent.setup();
    render(<PantryView rows={ROWS} />);
    await user.click(screen.getByLabelText("Increase garlic"));
    expect(actions.setPantryQuantity).toHaveBeenCalledWith("garlic", 4);
  });

  it("cart adds a manual grocery item and flips to added state", async () => {
    const user = userEvent.setup();
    render(<PantryView rows={ROWS} />);
    await user.click(screen.getByLabelText("Add garlic to grocery list"));
    expect(actions.addManualItem).toHaveBeenCalledWith("garlic");
    expect(screen.getByLabelText("garlic is already on your grocery list")).toBeDisabled();
  });

  it("cart is disabled for items already on the list", () => {
    render(<PantryView rows={ROWS} />);
    expect(screen.getByLabelText("milk is already on your grocery list")).toBeDisabled();
  });

  it("X depletes: row disappears and a toast offers Undo and Add to list", async () => {
    const user = userEvent.setup();
    render(<PantryView rows={ROWS} />);
    await user.click(screen.getByLabelText("Out of garlic — remove from pantry"));
    expect(actions.depletePantryItem).toHaveBeenCalledWith("garlic");
    expect(screen.queryByText("garlic")).not.toBeInTheDocument();
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "garlic removed",
        actions: [
          expect.objectContaining({ label: "Undo" }),
          expect.objectContaining({ label: "Add to list" }),
        ],
      }),
    );
  });

  it("Undo restores the row at its prior quantity", async () => {
    const user = userEvent.setup();
    render(<PantryView rows={ROWS} />);
    await user.click(screen.getByLabelText("Out of garlic — remove from pantry"));
    const { actions: toastActions } = toastSpy.mock.calls[0][0];
    toastActions.find((a: { label: string }) => a.label === "Undo").onAction();
    expect(actions.setPantryQuantity).toHaveBeenCalledWith("garlic", 3);
    expect(await screen.findByText("garlic")).toBeInTheDocument();
  });
});
