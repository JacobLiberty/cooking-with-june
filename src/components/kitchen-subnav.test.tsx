import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/shop",
}));

import { KitchenSubnav } from "@/components/kitchen-subnav";

describe("KitchenSubnav", () => {
  it("renders Menu, Shop, and Pantry links", () => {
    render(<KitchenSubnav />);
    expect(screen.getByRole("link", { name: "Menu" })).toHaveAttribute("href", "/menu");
    expect(screen.getByRole("link", { name: "Shop" })).toHaveAttribute("href", "/shop");
    expect(screen.getByRole("link", { name: "Pantry" })).toHaveAttribute("href", "/pantry");
  });

  it("marks the current route as the active page", () => {
    render(<KitchenSubnav />);
    expect(screen.getByRole("link", { name: "Shop" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Menu" })).not.toHaveAttribute("aria-current");
  });
});
