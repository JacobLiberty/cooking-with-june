import { describe, it, expect } from "vitest";
import { parseFilters, serializeFilters } from "@/lib/recipe-query-state";

describe("parseFilters", () => {
  it("defaults when params are empty", () => {
    expect(parseFilters(new URLSearchParams())).toEqual({
      query: "",
      ingredientIds: [],
      mode: "any",
      tags: [],
      sort: "name",
    });
  });
  it("parses all params", () => {
    const p = new URLSearchParams("q=beef&ing=a,b&mode=all&tag=Dinner,Quick&sort=rating");
    expect(parseFilters(p)).toEqual({
      query: "beef",
      ingredientIds: ["a", "b"],
      mode: "all",
      tags: ["Dinner", "Quick"],
      sort: "rating",
    });
  });
  it("ignores invalid mode/sort, falling back to defaults", () => {
    const p = new URLSearchParams("mode=weird&sort=bogus");
    const f = parseFilters(p);
    expect(f.mode).toBe("any");
    expect(f.sort).toBe("name");
  });
});

describe("serializeFilters", () => {
  it("omits defaults and round-trips non-defaults", () => {
    expect(serializeFilters({ query: "", ingredientIds: [], mode: "any", tags: [], sort: "name" })).toBe("");
    const s = serializeFilters({ query: "beef", ingredientIds: ["a", "b"], mode: "all", tags: ["Dinner"], sort: "rating" });
    const p = new URLSearchParams(s);
    expect(p.get("q")).toBe("beef");
    expect(p.get("ing")).toBe("a,b");
    expect(p.get("mode")).toBe("all");
    expect(p.get("tag")).toBe("Dinner");
    expect(p.get("sort")).toBe("rating");
  });
});
