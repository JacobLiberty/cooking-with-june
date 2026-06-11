import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("@cvx/_generated/api", () => ({
  api: { households: { viewer: "households.viewer" } },
}));

import { useQuery } from "convex/react";
import { AuthControls } from "@/components/auth-controls";

const mockUseQuery = useQuery as ReturnType<typeof vi.fn>;

describe("AuthControls", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
  });

  it("renders a loading placeholder while the query is resolving", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(<AuthControls />);
    expect(screen.getByText("···")).toBeInTheDocument();
  });

  it("renders Sign in when unauthenticated", () => {
    mockUseQuery.mockReturnValue(null);
    render(<AuthControls />);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("renders the Plan link, name, and Sign out for a household member", () => {
    mockUseQuery.mockReturnValue({ name: "Jacob", householdId: "h1" });
    render(<AuthControls />);
    expect(screen.getByRole("link", { name: "Plan" })).toBeInTheDocument();
    expect(screen.getByText("Jacob")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("renders Finish setup (not Plan) when signed in without a household", () => {
    mockUseQuery.mockReturnValue({ name: "Jacob", householdId: null });
    render(<AuthControls />);
    expect(screen.getByRole("link", { name: "Finish setup" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Plan" })).not.toBeInTheDocument();
  });
});
