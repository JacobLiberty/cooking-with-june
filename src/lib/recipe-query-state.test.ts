import { describe, it, expect } from "vitest";
import { parseFilters, serializeFilters } from "@/lib/recipe-query-state";

describe("parseFilters", () => {
  it("defaults when params are empty", () => {
    expect(parseFilters(new URLSearchParams())).toEqual({
      query: "",
      ingredientIds: [],
      cookable: "off",
      tags: [],
      collection: "all",
      sort: "name",
    });
  });
  it("parses all params", () => {
    const p = new URLSearchParams(
      "q=beef&ing=a,b&cook=now&tag=Dinner,Quick&col=totry&sort=rating",
    );
    expect(parseFilters(p)).toEqual({
      query: "beef",
      ingredientIds: ["a", "b"],
      cookable: "now",
      tags: ["Dinner", "Quick"],
      collection: "totry",
      sort: "rating",
    });
  });
  it("accepts cook=2", () => {
    expect(parseFilters(new URLSearchParams("cook=2")).cookable).toBe("2");
  });
  it("ignores invalid cookable/sort/collection, falling back to defaults", () => {
    const p = new URLSearchParams("cook=bogus&sort=bogus&col=nope");
    const f = parseFilters(p);
    expect(f.cookable).toBe("off");
    expect(f.sort).toBe("name");
    expect(f.collection).toBe("all");
  });

  it("round-trips the cookable filter", () => {
    const f = parseFilters(new URLSearchParams("cook=2"));
    expect(f.cookable).toBe("2");
    expect(serializeFilters(f)).toContain("cook=2");
  });
  it("defaults cookable to off and omits it when off", () => {
    const f = parseFilters(new URLSearchParams(""));
    expect(f.cookable).toBe("off");
    expect(serializeFilters({ ...f })).not.toContain("cook");
  });
  it("falls back to off for an unknown cookable value", () => {
    expect(parseFilters(new URLSearchParams("cook=bogus")).cookable).toBe("off");
  });
});

describe("serializeFilters", () => {
  it("omits defaults and round-trips non-defaults", () => {
    expect(
      serializeFilters({
        query: "",
        ingredientIds: [],
        cookable: "off",
        tags: [],
        collection: "all",
        sort: "name",
      }),
    ).toBe("");
    const s = serializeFilters({
      query: "beef",
      ingredientIds: ["a", "b"],
      cookable: "now",
      tags: ["Dinner"],
      collection: "approved",
      sort: "rating",
    });
    const p = new URLSearchParams(s);
    expect(p.get("q")).toBe("beef");
    expect(p.get("ing")).toBe("a,b");
    expect(p.get("cook")).toBe("now");
    expect(p.get("tag")).toBe("Dinner");
    expect(p.get("col")).toBe("approved");
    expect(p.get("sort")).toBe("rating");
  });
});
