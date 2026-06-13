import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const actions = vi.hoisted(() => ({
  markBought: vi.fn(),
  skipItem: vi.fn(),
  removeManualItem: vi.fn(),
  addShopItemByName: vi.fn(),
  setBuyQuantity: vi.fn(),
}));
vi.mock("@/app/actions/kitchen-actions", () => actions);
vi.mock("@/components/toast", () => ({ useToast: () => vi.fn() }));

import { ShopView } from "@/components/shop-view";
import type { ShopNeed, ShopManual } from "@/lib/kitchen/shop-grouping";

const NEEDS: ShopNeed[] = [
  { ingredientId: "beef", name: "beef", amount: 450, optional: false, category: "protein", canonicalUnitKind: "mass", buyQuantityG: 500 },
  { ingredientId: "parsley", name: "parsley", amount: 10, optional: true, category: "produce", canonicalUnitKind: "mass", buyQuantityG: 10 },
];
const MANUAL: ShopManual[] = [
  { ingredientId: "napkins", source: "manual", manualQuantity: { quantity: 1, unit: "pack" }, name: "napkins", canonicalUnitKind: null, category: "nonfood", buyQuantityG: null },
];
const CATALOG = [
  { _id: "beef", name: "beef" },
  { _id: "salt", name: "sea salt" },
];

beforeEach(() => {
  Object.values(actions).forEach((m) => m.mockReset().mockResolvedValue(undefined));
  actions.addShopItemByName.mockResolvedValue({ ingredientId: "salt" });
});

describe("ShopView", () => {
  it("renders category groups in store order with optional last", () => {
    render(<ShopView needs={NEEDS} manual={MANUAL} catalog={CATALOG} />);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Protein", "Non-food", "Nice to have"]);
  });

  it("shows the optional item under the Nice to have group", () => {
    render(<ShopView needs={NEEDS} manual={MANUAL} catalog={CATALOG} />);
    const optional = screen.getByRole("heading", { name: "Nice to have" }).closest("section") as HTMLElement;
    expect(within(optional).getByText("parsley")).toBeInTheDocument();
  });

  it("shows the add-item field above the list", () => {
    render(<ShopView needs={NEEDS} manual={MANUAL} catalog={CATALOG} />);
    const input = screen.getByLabelText("Add a grocery item");
    const firstGroup = screen.getAllByRole("heading", { level: 2 })[0];
    expect(input.compareDocumentPosition(firstGroup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("checking an item calls markBought with its buy quantity and crosses it out in place", async () => {
    const user = userEvent.setup();
    render(<ShopView needs={NEEDS} manual={MANUAL} catalog={CATALOG} />);
    await user.click(screen.getByLabelText("Got beef"));
    expect(actions.markBought).toHaveBeenCalledWith("beef", 500);
    expect(screen.getByText("beef")).toBeInTheDocument(); // still visible
    expect(screen.getByText(/added 500 g to pantry/)).toBeInTheDocument();
    expect(screen.getByText(/1 of 3 in the basket/)).toBeInTheDocument();
  });

  it("checking an unresolvable item passes null", async () => {
    const user = userEvent.setup();
    render(<ShopView needs={NEEDS} manual={MANUAL} catalog={CATALOG} />);
    await user.click(screen.getByLabelText("Got napkins"));
    expect(actions.markBought).toHaveBeenCalledWith("napkins", null);
    expect(screen.getByText("checked off")).toBeInTheDocument();
  });

  it("always shows the progress bar (no shopping mode button)", () => {
    render(<ShopView needs={NEEDS} manual={MANUAL} catalog={CATALOG} />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start shopping/ })).not.toBeInTheDocument();
  });

  it("clear checked-off removes crossed-out rows", async () => {
    const user = userEvent.setup();
    render(<ShopView needs={NEEDS} manual={MANUAL} catalog={CATALOG} />);
    await user.click(screen.getByLabelText("Got beef"));
    await user.click(screen.getByRole("button", { name: "Clear checked-off items" }));
    expect(screen.queryByText("beef")).not.toBeInTheDocument();
  });

  it("uses the Won't buy label for both need and manual items", async () => {
    const user = userEvent.setup();
    render(<ShopView needs={NEEDS} manual={MANUAL} catalog={CATALOG} />);
    await user.click(screen.getByLabelText("Won't buy beef"));
    expect(actions.skipItem).toHaveBeenCalledWith("beef");
    await user.click(screen.getByLabelText("Won't buy napkins"));
    expect(actions.removeManualItem).toHaveBeenCalledWith("napkins");
  });

  it("expanding the meta line and nudging commits a new buy quantity", async () => {
    const user = userEvent.setup();
    render(<ShopView needs={NEEDS} manual={MANUAL} catalog={CATALOG} />);
    await user.click(screen.getByLabelText("Adjust buy quantity for beef"));
    await user.click(screen.getByLabelText("Increase buy quantity for beef"));
    expect(actions.setBuyQuantity).toHaveBeenCalledWith("beef", 510);
  });

  it("adding a catalog name calls addShopItemByName", async () => {
    const user = userEvent.setup();
    render(<ShopView needs={NEEDS} manual={MANUAL} catalog={CATALOG} />);
    await user.type(screen.getByLabelText("Add a grocery item"), "sea salt");
    await user.click(screen.getByRole("button", { name: "sea salt" }));
    expect(actions.addShopItemByName).toHaveBeenCalledWith("sea salt");
  });

  it("offers create-if-missing for an unknown name", async () => {
    const user = userEvent.setup();
    render(<ShopView needs={NEEDS} manual={MANUAL} catalog={CATALOG} />);
    await user.type(screen.getByLabelText("Add a grocery item"), "dragonfruit");
    await user.click(screen.getByRole("button", { name: /Create/ }));
    expect(actions.addShopItemByName).toHaveBeenCalledWith("dragonfruit");
  });
});
