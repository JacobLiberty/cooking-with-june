// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

test("roundPantryQuantities rounds existing decimal rows and reports counts", async () => {
  const t = convexTest(schema, modules);
  const householdId = await t.run(async (ctx) => {
    const ownerUserId = await ctx.db.insert("users", { email: "a@example.com" });
    const hh = await ctx.db.insert("households", { name: "h", ownerUserId });
    await ctx.db.insert("pantryItems", {
      householdId: hh, ingredientId: "i1", quantityG: 740.3, updatedAt: 1,
    });
    await ctx.db.insert("pantryItems", {
      householdId: hh, ingredientId: "i2", quantityG: 100, updatedAt: 1,
    });
    return hh;
  });
  const result = await t.mutation(internal.migrations.roundPantryQuantities, {});
  expect(result).toEqual({ scanned: 2, updated: 1 });
  const rows = await t.run(async (ctx) =>
    ctx.db
      .query("pantryItems")
      .withIndex("by_household", (q) => q.eq("householdId", householdId))
      .collect(),
  );
  expect(rows.map((r) => r.quantityG).sort()).toEqual([100, 740]);
});
