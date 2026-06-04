import { describe, it, expect } from "vitest";
import { isJuneApproved } from "@/lib/june-approved";

describe("isJuneApproved", () => {
  it("requires at least two ratings, all >= 4.5", () => {
    expect(isJuneApproved(null)).toBe(false);
    expect(isJuneApproved([])).toBe(false);
    expect(isJuneApproved([{ editor: "Jacob", value: 5 }])).toBe(false); // only one
    expect(
      isJuneApproved([
        { editor: "Jacob", value: 5 },
        { editor: "Lily", value: 4.5 },
      ]),
    ).toBe(true);
    expect(
      isJuneApproved([
        { editor: "Jacob", value: 5 },
        { editor: "Lily", value: 4 },
      ]),
    ).toBe(false); // one below 4.5
  });
});
