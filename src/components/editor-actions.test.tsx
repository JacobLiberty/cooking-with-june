import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditorActions } from "@/components/editor-actions";

const actions = vi.hoisted(() => ({
  toggleWishlist: vi.fn(),
  markMade: vi.fn(),
  unmarkMade: vi.fn(),
}));
const convexMocks = vi.hoisted(() => ({ rateMutation: vi.fn() }));
vi.mock("@/app/actions/recipe-actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("convex/react", () => ({ useMutation: () => convexMocks.rateMutation }));
vi.mock("@cvx/_generated/api", () => ({
  api: {
    ratings: { rate: "ratings.rate" },
    recipeState: {
      markMade: "recipeState.markMade",
      unmarkMade: "recipeState.unmarkMade",
      setToTry: "recipeState.setToTry",
    },
  },
}));
vi.mock("@/components/toast", () => ({ useToast: () => vi.fn() }));

// Render motion components as plain elements (we test rating logic, not motion).
vi.mock("motion/react", () => {
  const make = (tag: string) =>
    function MotionEl({ children }: { children?: React.ReactNode }) {
      return React.createElement(tag, {}, children);
    };
  return {
    m: new Proxy({}, { get: (_t, tag: string) => make(tag) }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});

beforeEach(() => {
  convexMocks.rateMutation.mockReset().mockResolvedValue(undefined);
});

describe("EditorActions rating slider", () => {
  it("exposes the rating as a slider with the current value", () => {
    render(
      <EditorActions recipeId="r1" initialMyRating={3.5} initialToTry={false} />,
    );
    const slider = screen.getByRole("slider", { name: "Your rating" });
    expect(slider).toHaveAttribute("aria-valuenow", "3.5");
    expect(slider).toHaveAttribute("aria-valuetext", "3.5 of 5 stars");
  });

  it("steps by half a star with the arrow keys", () => {
    render(
      <EditorActions recipeId="r1" initialMyRating={null} initialToTry={false} />,
    );
    const slider = screen.getByRole("slider", { name: "Your rating" });

    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(convexMocks.rateMutation).toHaveBeenLastCalledWith({ recipeId: "r1", value: 0.5 });

    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(convexMocks.rateMutation).toHaveBeenLastCalledWith({ recipeId: "r1", value: 1 });
  });

  it("jumps to the ends with Home and End and never exceeds the range", () => {
    render(
      <EditorActions recipeId="r1" initialMyRating={2} initialToTry={false} />,
    );
    const slider = screen.getByRole("slider", { name: "Your rating" });

    fireEvent.keyDown(slider, { key: "End" });
    expect(convexMocks.rateMutation).toHaveBeenLastCalledWith({ recipeId: "r1", value: 5 });
    // already at max → no further change
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(convexMocks.rateMutation).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(slider, { key: "Home" });
    expect(convexMocks.rateMutation).toHaveBeenLastCalledWith({ recipeId: "r1", value: 0 });
  });
});
