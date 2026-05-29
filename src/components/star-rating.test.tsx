import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StarRating } from "@/components/star-rating";

describe("StarRating", () => {
  it("exposes an accessible label with the value", () => {
    render(<StarRating value={4.5} />);
    expect(screen.getByRole("img", { name: "4.5 out of 5 stars" })).toBeInTheDocument();
  });
  it("always renders five star glyphs", () => {
    const { container } = render(<StarRating value={3} />);
    expect(container.querySelectorAll("svg").length).toBe(5);
  });
});
