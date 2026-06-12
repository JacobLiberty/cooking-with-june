import { describe, it, expect, vi, beforeEach } from "vitest";

const generate = vi.fn();
vi.mock("@/sanity/lib/write-client", () => ({
  getWriteClient: () => ({ agent: { action: { generate: (...a: unknown[]) => generate(...a) } } }),
}));

import { coverInstruction, generateRecipeCover } from "@/lib/import/cover";

beforeEach(() => generate.mockReset());

describe("coverInstruction", () => {
  it("names the dish and asks for the cozy editorial style", () => {
    const p = coverInstruction("Weeknight Chili");
    expect(p).toContain("Weeknight Chili");
    expect(p.toLowerCase()).toMatch(/cozy|editorial|terracotta|appetizing/);
  });
});

describe("generateRecipeCover", () => {
  it("calls Agent Actions generate with the doc id, schema, and cover target", async () => {
    generate.mockResolvedValueOnce({});
    await generateRecipeCover("rec-1", "Weeknight Chili");
    expect(generate).toHaveBeenCalledTimes(1);
    const arg = generate.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.documentId).toBe("rec-1");
    expect(arg.schemaId).toBe("_.schemas.default");
    expect(arg.instruction).toContain("Weeknight Chili");
  });

  it("never throws when generation fails (best-effort)", async () => {
    generate.mockRejectedValueOnce(new Error("experimental API down"));
    await expect(generateRecipeCover("rec-1", "X")).resolves.toBeUndefined();
  });
});
