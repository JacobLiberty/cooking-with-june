import { describe, it, expect, vi, beforeEach } from "vitest";

const generate = vi.fn();
const withConfig = vi.fn();
const agentClient = { agent: { action: { generate: (...a: unknown[]) => generate(...a) } } };
vi.mock("@/sanity/lib/write-client", () => ({
  // generate runs on a `vX`-configured client variant.
  getWriteClient: () => ({ withConfig: (...a: unknown[]) => (withConfig(...a), agentClient) }),
}));

import { coverInstruction, generateRecipeCover } from "@/lib/import/cover";

beforeEach(() => {
  generate.mockReset();
  withConfig.mockReset();
});

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
    // Agent Actions must run on the experimental `vX` API version.
    expect(withConfig).toHaveBeenCalledWith({ apiVersion: "vX" });
    const arg = generate.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.documentId).toBe("rec-1");
    expect(arg.schemaId).toBe("_.schemas.default");
    expect(arg.instruction).toContain("Weeknight Chili");
    // `images` is an array — target the array so a new item is appended.
    expect(arg.target).toEqual({ path: ["images"] });
    // Write to the published recipe, not a draft (recipes have no draft flow).
    expect(arg.forcePublishedWrite).toBe(true);
  });

  it("never throws when generation fails (best-effort)", async () => {
    generate.mockRejectedValueOnce(new Error("experimental API down"));
    await expect(generateRecipeCover("rec-1", "X")).resolves.toBeUndefined();
  });
});
