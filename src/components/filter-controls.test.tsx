import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterControls } from "@/components/filter-controls";
import type { RecipeFilters } from "@/lib/recipe-filter";

const base: RecipeFilters = {
  query: "", ingredientIds: [], cookable: "off", tags: [], collection: "all", sort: "name",
};
const ingredients = [
  { _id: "beef", name: "beef" },
  { _id: "rice", name: "rice" },
];
const tags = [{ _id: "t1", name: "dinner" }];

const setup = (filters: RecipeFilters = base, showCookable = false) => {
  const onChange = vi.fn();
  render(
    <FilterControls
      filters={filters}
      ingredients={ingredients}
      tags={tags}
      showCookable={showCookable}
      onChange={onChange}
    />,
  );
  return onChange;
};

describe("FilterControls", () => {
  it("hides the cookable stepper unless showCookable is set", () => {
    setup(base, false);
    expect(screen.queryByRole("group", { name: "Cookable filter" })).not.toBeInTheDocument();
  });

  it("shows the cookable stepper and reports the chosen step", async () => {
    const user = userEvent.setup();
    const onChange = setup(base, true);
    await user.click(screen.getByRole("button", { name: "Cookable now" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ cookable: "now" }));
  });

  it("adds an ingredient from the typeahead", async () => {
    const user = userEvent.setup();
    const onChange = setup();
    await user.type(screen.getByLabelText("Filter by ingredient"), "bee");
    await user.click(screen.getByRole("button", { name: /beef/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ ingredientIds: ["beef"] }));
  });

  it("removes an active ingredient chip", async () => {
    const user = userEvent.setup();
    const onChange = setup({ ...base, ingredientIds: ["beef"] });
    await user.click(screen.getByRole("button", { name: "Remove beef filter" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ ingredientIds: [] }));
  });

  it("toggles a tag", async () => {
    const user = userEvent.setup();
    const onChange = setup();
    await user.click(screen.getByRole("button", { name: /dinner/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ tags: ["dinner"] }));
  });
});
