import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({ createInvite: vi.fn() }));
vi.mock("convex/react", () => ({ useMutation: () => mocks.createInvite }));
vi.mock("@cvx/_generated/api", () => ({
  api: { households: { createInvite: "households.createInvite" } },
}));

import { InvitePanel } from "@/components/invite-panel";

beforeEach(() => mocks.createInvite.mockReset());

describe("InvitePanel", () => {
  it("generates and shows a shareable invite code", async () => {
    const user = userEvent.setup();
    mocks.createInvite.mockResolvedValue("ABCD2345");
    render(<InvitePanel />);
    await user.click(screen.getByRole("button", { name: "Invite someone" }));
    expect(mocks.createInvite).toHaveBeenCalledWith({});
    expect(await screen.findByLabelText("invite code")).toHaveTextContent("ABCD2345");
  });
});
