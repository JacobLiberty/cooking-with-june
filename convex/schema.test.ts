// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

test("planRecipes / pantryItems / groceryItems tables accept rows", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const householdId = await ctx.db.insert("households", {
      name: "h",
      ownerUserId: await ctx.db.insert("users", { email: "x@example.com" }),
    });
    const userId = await ctx.db.insert("users", { email: "y@example.com" });

    const plan = await ctx.db.insert("planRecipes", {
      householdId,
      recipeId: "r1",
      scale: 2,
      addedAt: 1,
    });
    const pantry = await ctx.db.insert("pantryItems", {
      householdId,
      ingredientId: "i1",
      quantityG: 500,
      updatedAt: 1,
    });
    const grocery = await ctx.db.insert("groceryItems", {
      householdId,
      ingredientId: "i2",
      source: "manual",
      manualQuantity: { quantity: 2, unit: "lb" },
      addedByUserId: userId,
      createdAt: 1,
    });

    expect((await ctx.db.get(plan))?.scale).toBe(2);
    expect((await ctx.db.get(pantry))?.quantityG).toBe(500);
    expect((await ctx.db.get(grocery))?.source).toBe("manual");
  });
});

test("by_household_ingredient index is queryable on pantryItems", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const householdId = await ctx.db.insert("households", {
      name: "h",
      ownerUserId: await ctx.db.insert("users", { email: "z@example.com" }),
    });
    await ctx.db.insert("pantryItems", {
      householdId,
      ingredientId: "i1",
      quantityG: 10,
      updatedAt: 1,
    });
    const row = await ctx.db
      .query("pantryItems")
      .withIndex("by_household_ingredient", (q) =>
        q.eq("householdId", householdId).eq("ingredientId", "i1"),
      )
      .unique();
    expect(row?.quantityG).toBe(10);
  });
});
