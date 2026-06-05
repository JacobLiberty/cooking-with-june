import { describe, it, expect } from "vitest";
import { parseStepTimers, ingredientsInStep } from "@/lib/cook-extras";

describe("parseStepTimers", () => {
  it("finds minutes, hours, and seconds", () => {
    expect(parseStepTimers("Simmer for 25 minutes")).toEqual([
      { label: "25 min", seconds: 1500 },
    ]);
    expect(parseStepTimers("Bake 1 hour")).toEqual([
      { label: "1 hr", seconds: 3600 },
    ]);
    expect(parseStepTimers("Rest 90 seconds")).toEqual([
      { label: "90 sec", seconds: 90 },
    ]);
  });

  it("handles abbreviations and multiple timers, de-duping equal durations", () => {
    expect(parseStepTimers("Sauté 5 min, then another 5 mins")).toEqual([
      { label: "5 min", seconds: 300 },
    ]);
    const two = parseStepTimers("Brown 3 min then roast 40 min");
    expect(two.map((t) => t.seconds)).toEqual([180, 2400]);
  });

  it("returns nothing when there is no duration", () => {
    expect(parseStepTimers("Season to taste")).toEqual([]);
  });
});

describe("ingredientsInStep", () => {
  const names = ["Yellow onion", "Garlic", "Beef chuck", "Salt"];

  it("matches ingredients named in the step by their head word", () => {
    expect(
      ingredientsInStep("Sweat the onion until soft, add garlic", names),
    ).toEqual(["Yellow onion", "Garlic"]);
  });

  it("does not match ingredients that aren't mentioned", () => {
    expect(ingredientsInStep("Bring water to a boil", names)).toEqual([]);
  });

  it("matches whole words only (no partial 'salt' inside 'salted')", () => {
    expect(ingredientsInStep("Use unsalted butter", names)).toEqual([]);
  });

  it("ignores empty / null names", () => {
    expect(ingredientsInStep("add salt", ["Salt", null, ""])).toEqual(["Salt"]);
  });
});
