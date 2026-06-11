import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("@cvx/_generated/api", () => ({ api: { users: { me: "users.me" } } }));

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

  it("renders the Plan link, name, and Sign out when signed in", () => {
    mockUseQuery.mockReturnValue({ name: "Jacob" });
    render(<AuthControls />);
    expect(screen.getByRole("link", { name: "Plan" })).toBeInTheDocument();
    expect(screen.getByText("Jacob")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("renders Sign out without a name when the user has no name", () => {
    mockUseQuery.mockReturnValue({ name: null });
    render(<AuthControls />);
    expect(screen.queryByText("Jacob")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
