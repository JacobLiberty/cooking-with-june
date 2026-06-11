import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  createHousehold: vi.fn(),
  acceptInvite: vi.fn(),
  push: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useMutation: (ref: string) =>
    ref === "households.createHousehold"
      ? mocks.createHousehold
      : mocks.acceptInvite,
}));
vi.mock("@cvx/_generated/api", () => ({
  api: {
    households: {
      createHousehold: "households.createHousehold",
      acceptInvite: "households.acceptInvite",
    },
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));

import { HouseholdSetup } from "@/components/household-setup";

describe("HouseholdSetup", () => {
  beforeEach(() => {
    mocks.createHousehold.mockReset().mockResolvedValue("h1");
    mocks.acceptInvite.mockReset().mockResolvedValue("h1");
    mocks.push.mockReset();
  });

  it("creates a household and routes to the plan", async () => {
    render(<HouseholdSetup />);
    fireEvent.change(screen.getByLabelText("Household name"), {
      target: { value: "Jacob & Lily" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create household" }));
    await waitFor(() =>
      expect(mocks.createHousehold).toHaveBeenCalledWith({ name: "Jacob & Lily" }),
    );
    expect(mocks.push).toHaveBeenCalledWith("/plan");
  });

  it("joins with a code and routes to the plan", async () => {
    render(<HouseholdSetup />);
    fireEvent.change(screen.getByLabelText("Invite code"), {
      target: { value: "ABCD2345" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Join household" }));
    await waitFor(() =>
      expect(mocks.acceptInvite).toHaveBeenCalledWith({ code: "ABCD2345" }),
    );
    expect(mocks.push).toHaveBeenCalledWith("/plan");
  });

  it("hides the create form for non-founders (invite-only)", () => {
    render(<HouseholdSetup canCreate={false} />);
    expect(
      screen.queryByRole("button", { name: "Create household" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Join household" }),
    ).toBeInTheDocument();
  });

  it("shows the error and does not route when a mutation fails", async () => {
    mocks.acceptInvite.mockRejectedValue(new Error("Invalid invite code"));
    render(<HouseholdSetup />);
    fireEvent.change(screen.getByLabelText("Invite code"), {
      target: { value: "NOPE2345" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Join household" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid invite code"),
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
