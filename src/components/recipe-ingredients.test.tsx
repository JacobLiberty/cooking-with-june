import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecipeIngredients } from "@/components/recipe-ingredients";
import type { IngredientLineView } from "@/sanity/types";

const ingredients: IngredientLineView[] = [
  { _key: "k1", quantity: "1", unit: "cup", name: "Flour" },
  { _key: "k2", quantity: "2", unit: "", name: "Eggs" },
];

// jsdom here doesn't ship a full localStorage — install a Map-backed mock.
beforeEach(() => {
  const store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    },
  });
});

describe("RecipeIngredients", () => {
  it("rescales quantities when servings change", async () => {
    const user = userEvent.setup();
    render(
      <RecipeIngredients recipeId="r1" baseServings={2} ingredients={ingredients} />,
    );
    expect(screen.getByText("Flour")).toBeInTheDocument();
    // base 2 servings shows 1 cup flour, 2 eggs
    expect(screen.getByText("1 cup")).toBeInTheDocument();

    // bump to 4 servings → flour doubled to 2 cup
    await user.click(screen.getByRole("button", { name: "More servings" }));
    await user.click(screen.getByRole("button", { name: "More servings" }));
    expect(screen.getByText("2 cup")).toBeInTheDocument();
    expect(screen.queryByText("1 cup")).not.toBeInTheDocument();
  });

  it("crosses an item off and persists it to localStorage", async () => {
    const user = userEvent.setup();
    render(
      <RecipeIngredients recipeId="r1" baseServings={2} ingredients={ingredients} />,
    );
    await user.click(screen.getByRole("checkbox", { name: "Cross off Flour" }));

    expect(screen.getByRole("checkbox", { name: "Cross off Flour" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    const stored = JSON.parse(
      window.localStorage.getItem("cwj:recipe-checks:r1") ?? "[]",
    );
    expect(stored).toContain("k1");
  });

  it("hides the serving stepper when there is no base serving count", () => {
    render(<RecipeIngredients recipeId="r1" ingredients={ingredients} />);
    expect(
      screen.queryByRole("button", { name: "More servings" }),
    ).not.toBeInTheDocument();
  });
});
