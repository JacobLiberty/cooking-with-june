import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const actions = vi.hoisted(() => ({
  markBought: vi.fn(),
  skipItem: vi.fn(),
  removeManualItem: vi.fn(),
  addShopItemByName: vi.fn(),
}));
vi.mock("@/app/actions/kitchen-actions", () => actions);
vi.mock("@/components/toast", () => ({ useToast: () => vi.fn() }));

import { ShopView } from "@/components/shop-view";
import type { ShopNeed, ShopManual } from "@/lib/kitchen/shop-grouping";

const NEEDS: ShopNeed[] = [
  { ingredientId: "beef", name: "beef", amount: 450, optional: false, category: "protein", canonicalUnitKind: "mass" },
  { ingredientId: "parsley", name: "parsley", amount: 10, optional: true, category: "produce", canonicalUnitKind: "mass" },
];
const MANUAL: ShopManual[] = [
  { ingredientId: "napkins", source: "manual", manualQuantity: { quantity: 1, unit: "pack" }, name: "napkins", canonicalUnitKind: null, category: "nonfood" },
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

  it("checking an item off calls markBought and removes it", async () => {
    const user = userEvent.setup();
    render(<ShopView needs={NEEDS} manual={MANUAL} catalog={CATALOG} />);
    await user.click(screen.getByLabelText("Got beef"));
    expect(actions.markBought).toHaveBeenCalledWith("beef");
  });

  it("dismissing a need calls skipItem; dismissing a manual calls removeManualItem", async () => {
    const user = userEvent.setup();
    render(<ShopView needs={NEEDS} manual={MANUAL} catalog={CATALOG} />);
    await user.click(screen.getByLabelText("Skip beef"));
    expect(actions.skipItem).toHaveBeenCalledWith("beef");
    await user.click(screen.getByLabelText("Remove napkins"));
    expect(actions.removeManualItem).toHaveBeenCalledWith("napkins");
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

  it("start shopping shows a progress indicator and hides the add form", async () => {
    const user = userEvent.setup();
    render(<ShopView needs={NEEDS} manual={MANUAL} catalog={CATALOG} />);
    await user.click(screen.getByRole("button", { name: "Start shopping" }));
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText(/0 of 3 done/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Add a grocery item")).not.toBeInTheDocument();
  });

  it("checking off during shopping advances the progress count", async () => {
    const user = userEvent.setup();
    render(<ShopView needs={NEEDS} manual={MANUAL} catalog={CATALOG} />);
    await user.click(screen.getByRole("button", { name: "Start shopping" }));
    await user.click(screen.getByLabelText("Got beef"));
    expect(screen.getByText(/1 of 3 done/)).toBeInTheDocument();
  });
});
