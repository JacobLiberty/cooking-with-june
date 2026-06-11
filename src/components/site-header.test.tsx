import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteHeader } from "@/components/site-header";

// NavLink reads the current path via next/navigation's usePathname.
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

// AuthControls needs Convex providers — stub it to a no-op for header tests.
vi.mock("./auth-controls", () => ({
  AuthControls: () => null,
}));

describe("SiteHeader", () => {
  it("renders the brand and primary nav links", () => {
    render(<SiteHeader />);
    expect(screen.getByText("Cooking with June")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
  });

  it("marks the current route's link as active", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
