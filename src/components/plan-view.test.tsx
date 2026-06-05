import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanView } from "@/components/plan-view";
import { MotionProvider } from "@/components/motion-provider";
import type { PlanRecipe } from "@/sanity/plan-types";

const actions = vi.hoisted(() => ({
  removeFromPlan: vi.fn(),
  checkGroceryIngredient: vi.fn(),
  skipGroceryIngredient: vi.fn(),
  removePantryIngredient: vi.fn(),
  movePantryIngredientToGrocery: vi.fn(),
  addManualItem: vi.fn(),
  setManualLocation: vi.fn(),
  removeManualItem: vi.fn(),
}));
vi.mock("@/app/actions/plan-actions", () => actions);

// Render motion components as plain elements so list changes are synchronous
// (we're unit-testing the grocery/pantry logic, not the animation).
vi.mock("motion/react", () => {
  const strip = new Set([
    "layout",
    "initial",
    "animate",
    "exit",
    "transition",
    "whileHover",
    "whileTap",
  ]);
  const make = (tag: string) =>
    function MotionEl({ children, ...props }: Record<string, unknown>) {
      const clean: Record<string, unknown> = {};
      for (const k in props) if (!strip.has(k)) clean[k] = props[k];
      return React.createElement(tag, clean, children as React.ReactNode);
    };
  function AnimatePresence({ children }: { children: React.ReactNode }) {
    return children;
  }
  function Passthrough({ children }: { children: React.ReactNode }) {
    return children;
  }
  return {
    AnimatePresence,
    m: new Proxy({}, { get: (_t, tag: string) => make(tag) }),
    LazyMotion: Passthrough,
    MotionConfig: Passthrough,
    domAnimation: {},
  };
});

// PlanRecipeRow → RecipeCover imports the image builder, which pulls in the
// Sanity client/env. Stub it so the test doesn't need env vars.
vi.mock("@/sanity/lib/image", () => ({
  urlForImage: () => ({
    width: () => ({ height: () => ({ fit: () => ({ auto: () => ({ url: () => "" }) }) }) }),
  }),
}));

const recipes: PlanRecipe[] = [
  {
    _id: "r1",
    title: "Onion Soup",
    slug: "onion-soup",
    coverImage: null,
    ingredients: [{ ingredientId: "onion", name: "Onion", quantity: "1", unit: "" }],
  },
];
const ingredients = [{ _id: "onion", name: "Onion" }];

function renderPlan(overrides: Partial<Parameters<typeof PlanView>[0]> = {}) {
  return render(
    <MotionProvider>
      <PlanView
        recipes={recipes}
        manual={[]}
        groceryIds={["onion"]}
        pantryIds={[]}
        ingredients={ingredients}
        recipeScales={[]}
        {...overrides}
      />
    </MotionProvider>,
  );
}

beforeEach(() => {
  Object.values(actions).forEach((fn) => fn.mockReset());
});

describe("PlanView — recipes tab", () => {
  it("shows a missing-ingredients badge based on the pantry", () => {
    renderPlan();
    expect(screen.getByText("Missing 1 ingredient")).toBeInTheDocument();
  });

  it("shows 'Have everything' when the pantry covers the recipe", () => {
    renderPlan({ groceryIds: [], pantryIds: ["onion"] });
    expect(screen.getByText("Have everything")).toBeInTheDocument();
  });
});

describe("PlanView — groceries tab", () => {
  it("checks an item off the grocery list into the pantry", async () => {
    actions.checkGroceryIngredient.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPlan();

    await user.click(screen.getByRole("tab", { name: "Groceries" }));
    expect(screen.getByText("Onion")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Got Onion" }));
    expect(actions.checkGroceryIngredient).toHaveBeenCalledWith("onion");

    // Onion leaves the grocery list (no checkbox) and gains a pantry "Out" action.
    expect(
      await screen.findByRole("button", {
        name: "Add Onion back to the grocery list",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "Got Onion" }),
    ).not.toBeInTheDocument();
  });

  it("rolls back when the check fails", async () => {
    actions.checkGroceryIngredient.mockRejectedValue(new Error("nope"));
    const user = userEvent.setup();
    renderPlan();

    await user.click(screen.getByRole("tab", { name: "Groceries" }));
    await user.click(screen.getByRole("checkbox", { name: "Got Onion" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't save/i);
    expect(screen.getByRole("checkbox", { name: "Got Onion" })).toBeInTheDocument();
  });

  it("skips an item off the grocery list without touching the pantry", async () => {
    actions.skipGroceryIngredient.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPlan();

    await user.click(screen.getByRole("tab", { name: "Groceries" }));
    await user.click(screen.getByRole("button", { name: "Skip Onion" }));

    expect(actions.skipGroceryIngredient).toHaveBeenCalledWith("onion");
    expect(
      screen.queryByRole("checkbox", { name: "Got Onion" }),
    ).not.toBeInTheDocument();
    // not added to the pantry
    expect(
      screen.queryByRole("button", {
        name: "Add Onion back to the grocery list",
      }),
    ).not.toBeInTheDocument();
  });
});
