import { describe, it, expect } from "vitest";
import { upsertRating, ratingKey, type StoredRating } from "@/lib/rating-mutate";

describe("upsertRating", () => {
  it("appends a new rating for a new editor", () => {
    const out = upsertRating([], "e1", 4.5);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      _key: ratingKey("e1"),
      _type: "rating",
      editor: { _type: "reference", _ref: "e1" },
      value: 4.5,
    });
  });
  it("replaces the same editor's rating without duplicating", () => {
    const existing: StoredRating[] = [
      { _key: ratingKey("e1"), _type: "rating", editor: { _type: "reference", _ref: "e1" }, value: 3 },
      { _key: ratingKey("e2"), _type: "rating", editor: { _type: "reference", _ref: "e2" }, value: 5 },
    ];
    const out = upsertRating(existing, "e1", 4);
    expect(out).toHaveLength(2);
    expect(out.find((r) => r.editor._ref === "e1")?.value).toBe(4);
    expect(out.find((r) => r.editor._ref === "e2")?.value).toBe(5);
  });
});
