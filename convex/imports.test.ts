// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.*s");

// Seed an authed user with a household membership so requireMembership passes.
// - users table (from authTables) only requires { email }
// - households table uses ownerUserId (not ownerId)
// - memberships table uses userId: Id<"users"> and householdId: Id<"households">
async function asMember(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) => {
    const uid = await ctx.db.insert("users", { email: "tester@example.com" });
    const hid = await ctx.db.insert("households", { name: "H", ownerUserId: uid });
    await ctx.db.insert("memberships", { userId: uid, householdId: hid, role: "owner" });
    return uid;
  });
  return t.withIdentity({ subject: userId });
}

describe("recordImport", () => {
  it("increments per user+day and rejects past the cap", async () => {
    const t = convexTest(schema, modules);
    const as = await asMember(t);
    // CAP is 25 — drive to the cap, then expect rejection
    for (let i = 0; i < 25; i++) await as.mutation(api.imports.recordImport, { dayKey: "2026-06-12" });
    await expect(as.mutation(api.imports.recordImport, { dayKey: "2026-06-12" })).rejects.toThrow(/limit/i);
    // A different day resets
    await as.mutation(api.imports.recordImport, { dayKey: "2026-06-13" });
  });

  it("rejects a non-member", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.imports.recordImport, { dayKey: "2026-06-12" }),
    ).rejects.toThrow();
  });
});
