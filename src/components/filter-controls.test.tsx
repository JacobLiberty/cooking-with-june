import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterControls } from "@/components/filter-controls";
import type { RecipeFilters } from "@/lib/recipe-filter";

const EMPTY: RecipeFilters = {
  query: "",
  ingredientIds: [],
  mode: "any",
  tags: [],
  sort: "name",
};

const tags = Array.from({ length: 15 }, (_, i) => ({
  _id: `t${i}`,
  name: `tag-${i}`,
}));

describe("FilterControls collapsing", () => {
  it("collapses tags past the limit and expands on demand", async () => {
    const user = userEvent.setup();
    render(
      <FilterControls filters={EMPTY} ingredients={[]} tags={tags} onChange={() => {}} />,
    );
    // collapsed: first 8 shown, the 9th hidden, a "+7 more" toggle present
    expect(screen.getByText("tag-0")).toBeInTheDocument();
    expect(screen.getByText("tag-7")).toBeInTheDocument();
    expect(screen.queryByText("tag-8")).not.toBeInTheDocument();
    const toggle = screen.getByText("+7 more");

    await user.click(toggle);
    expect(screen.getByText("tag-8")).toBeInTheDocument();
    expect(screen.getByText("tag-14")).toBeInTheDocument();
    expect(screen.getByText("Show fewer")).toBeInTheDocument();
  });

  it("keeps a selected tag visible even past the collapsed limit", () => {
    render(
      <FilterControls
        filters={{ ...EMPTY, tags: ["tag-12"] }}
        ingredients={[]}
        tags={tags}
        onChange={() => {}}
      />,
    );
    // tag-12 is beyond the limit but selected, so it stays visible/de-selectable
    const selected = screen.getByText("tag-12");
    expect(selected).toBeInTheDocument();
    expect(selected).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onChange when a tag is toggled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterControls filters={EMPTY} ingredients={[]} tags={tags} onChange={onChange} />,
    );
    await user.click(screen.getByText("tag-1"));
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY, tags: ["tag-1"] });
  });
});
