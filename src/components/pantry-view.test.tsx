import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const actions = vi.hoisted(() => ({
  setPantryQuantity: vi.fn(),
  setRestockOverride: vi.fn(),
}));
vi.mock("@/app/actions/kitchen-actions", () => actions);
vi.mock("@/components/toast", () => ({ useToast: () => vi.fn() }));

import { PantryView } from "@/components/pantry-view";
import type { PantryRowData } from "@/components/pantry-row";

const ROWS: PantryRowData[] = [
  {
    ingredientId: "beef",
    name: "ground beef",
    quantityG: 200,
    canonicalUnitKind: "mass",
    restockOverride: null,
    restockDefault: { quantity: 1, unit: "lb" },
  },
  {
    ingredientId: "egg",
    name: "egg",
    quantityG: 4,
    canonicalUnitKind: "count",
    restockOverride: { quantity: 12, unit: "" },
    restockDefault: { quantity: 12, unit: "" },
  },
];

beforeEach(() => {
  actions.setPantryQuantity.mockReset().mockResolvedValue(undefined);
  actions.setRestockOverride.mockReset().mockResolvedValue(undefined);
});

const rowFor = (name: string) => screen.getByText(name).closest("li") as HTMLElement;

describe("PantryView", () => {
  it("shows the empty state when there is no stock", () => {
    render(<PantryView rows={[]} />);
    expect(screen.getByText(/pantry is empty/i)).toBeInTheDocument();
  });

  it("renders each row with the correct unit label (g vs count)", () => {
    render(<PantryView rows={ROWS} />);
    expect(within(rowFor("ground beef")).getByText("g")).toBeInTheDocument();
    expect(within(rowFor("egg")).getByText("count")).toBeInTheDocument();
  });

  it("nudging mass up by + steps by 10 grams and calls setPantryQuantity", async () => {
    const user = userEvent.setup();
    render(<PantryView rows={ROWS} />);
    await user.click(within(rowFor("ground beef")).getByLabelText("Increase ground beef"));
    expect(actions.setPantryQuantity).toHaveBeenCalledWith("beef", 210);
  });

  it("nudging count down by − steps by 1 and never goes below 0", async () => {
    const user = userEvent.setup();
    render(<PantryView rows={[{ ...ROWS[1], quantityG: 0 }]} />);
    await user.click(within(rowFor("egg")).getByLabelText("Decrease egg"));
    expect(actions.setPantryQuantity).toHaveBeenCalledWith("egg", 0);
  });

  it("typing a new quantity commits it on blur", async () => {
    const user = userEvent.setup();
    render(<PantryView rows={ROWS} />);
    const input = within(rowFor("ground beef")).getByLabelText("ground beef quantity in g");
    await user.clear(input);
    await user.type(input, "350");
    await user.tab();
    expect(actions.setPantryQuantity).toHaveBeenCalledWith("beef", 350);
  });

  it("editing the restock override saves it via setRestockOverride", async () => {
    const user = userEvent.setup();
    render(<PantryView rows={ROWS} />);
    await user.click(within(rowFor("ground beef")).getByRole("button", { name: "Edit" }));
    const beef = rowFor("ground beef");
    await user.clear(within(beef).getByLabelText("Restock quantity"));
    await user.type(within(beef).getByLabelText("Restock quantity"), "2");
    await user.clear(within(beef).getByLabelText("Restock unit"));
    await user.type(within(beef).getByLabelText("Restock unit"), "lb");
    await user.click(within(beef).getByRole("button", { name: "Save" }));
    expect(actions.setRestockOverride).toHaveBeenCalledWith("beef", { quantity: 2, unit: "lb" });
  });

  it("resetting a custom restock clears the override", async () => {
    const user = userEvent.setup();
    render(<PantryView rows={ROWS} />);
    await user.click(within(rowFor("egg")).getByRole("button", { name: "Reset" }));
    expect(actions.setRestockOverride).toHaveBeenCalledWith("egg", undefined);
  });
});
