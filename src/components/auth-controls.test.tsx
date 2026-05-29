import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthControls } from "@/components/auth-controls";

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

import { useSession } from "next-auth/react";

const mockUseSession = useSession as ReturnType<typeof vi.fn>;

describe("AuthControls", () => {
  it("renders a loading placeholder while session is resolving", () => {
    mockUseSession.mockReturnValue({ data: null, status: "loading" });
    render(<AuthControls />);
    expect(screen.getByText("···")).toBeInTheDocument();
  });

  it("renders Sign in button when unauthenticated", () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    render(<AuthControls />);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("renders editor name and Sign out button when authenticated", () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: "Jacob", isEditor: true } },
      status: "authenticated",
    });
    render(<AuthControls />);
    expect(screen.getByText("Jacob")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("renders Sign out without a name when session user has no name", () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: null, isEditor: true } },
      status: "authenticated",
    });
    render(<AuthControls />);
    expect(screen.queryByText("Jacob")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
