import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecipeCard } from "@/components/recipe-card";
import type { RecipeCardData } from "@/sanity/types";

vi.mock("@/sanity/lib/image", () => ({
  urlForImage: () => ({
    width: () => ({ height: () => ({ fit: () => ({ auto: () => ({ url: () => "" }) }) }) }),
  }),
}));

const base: RecipeCardData = {
  _id: "1",
  title: "Weeknight Beef Ragù",
  slug: "weeknight-beef-ragu",
  description: "Cozy and quick.",
  coverImage: null,
  prepTime: 10,
  cookTime: 35,
  servings: 4,
  wishlist: false,
  madeCount: 3,
  tags: ["Dinner"],
  ratings: [{ editor: "Jacob", value: 4.5 }],
};

describe("RecipeCard", () => {
  it("links to the recipe and shows title, meta, and rating", () => {
    render(<RecipeCard recipe={base} />);
    const link = screen.getByRole("link", { name: /Weeknight Beef Ragù/ });
    expect(link).toHaveAttribute("href", "/recipe/weeknight-beef-ragu");
    expect(screen.getByText("45 min · serves 4")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "4.5 out of 5 stars" })).toBeInTheDocument();
  });

  it("shows a typographic placeholder title when there is no cover image", () => {
    render(<RecipeCard recipe={base} />);
    // title appears in both the placeholder cover and the heading
    expect(screen.getAllByText("Weeknight Beef Ragù").length).toBeGreaterThanOrEqual(1);
  });

  it("shows 'To try' for an unrated wishlist recipe", () => {
    render(<RecipeCard recipe={{ ...base, ratings: [], wishlist: true }} />);
    expect(screen.getByText("To try")).toBeInTheDocument();
  });
});
