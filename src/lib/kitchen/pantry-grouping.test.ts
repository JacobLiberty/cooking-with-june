import { describe, it, expect } from "vitest";
import { groupPantryRows } from "@/lib/kitchen/pantry-grouping";

const row = (name: string, category: string | null) => ({ name, category });

describe("groupPantryRows", () => {
  it("groups by store category in aisle order, alphabetical within", () => {
    const groups = groupPantryRows([
      row("olive oil", "pantry"),
      row("yellow onion", "produce"),
      row("garlic", "produce"),
      row("milk", "dairy"),
    ]);
    expect(groups.map((g) => g.label)).toEqual(["Produce", "Dairy", "Pantry"]);
    expect(groups[0].rows.map((r) => r.name)).toEqual(["garlic", "yellow onion"]);
  });
  it("folds unknown and nonfood categories into Other", () => {
    const groups = groupPantryRows([
      row("napkins", "nonfood"),
      row("mystery", null),
      row("weird", "not-a-category"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Other");
    expect(groups[0].rows.map((r) => r.name)).toEqual(["mystery", "napkins", "weird"]);
  });
  it("omits empty groups", () => {
    expect(groupPantryRows([])).toEqual([]);
  });
});
