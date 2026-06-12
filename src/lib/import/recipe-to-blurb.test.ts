import { describe, it, expect } from "vitest";
import { recipeToBlurb } from "@/lib/import/recipe-to-blurb";

describe("recipeToBlurb", () => {
  it("renders title, servings, ingredients (with optional), and numbered steps", () => {
    const blurb = recipeToBlurb({
      title: "Chili",
      description: "A pot of chili.",
      servings: 4,
      ingredients: [
        { quantity: "1", unit: "lb", name: "ground beef", optional: false },
        { quantity: "2", unit: "tbsp", name: "cilantro", optional: true },
      ],
      steps: ["Brown the beef.", "Simmer."],
    });
    expect(blurb).toContain("Chili");
    expect(blurb).toContain("Serves 4");
    expect(blurb).toMatch(/1 lb ground beef/);
    expect(blurb).toMatch(/cilantro \(optional\)/);
    expect(blurb).toMatch(/1\. Brown the beef\./);
    expect(blurb).toMatch(/2\. Simmer\./);
  });

  it("carries the story so re-import doesn't blank it", () => {
    const blurb = recipeToBlurb({
      title: "Chili",
      description: "A pot of chili.",
      story: "My grandmother made this every fall.",
      ingredients: null,
      steps: null,
    });
    expect(blurb).toContain("My grandmother made this every fall.");
  });

  it("tolerates missing fields", () => {
    const blurb = recipeToBlurb({ title: "Toast", ingredients: null, steps: null });
    expect(blurb).toContain("Toast");
  });
});
