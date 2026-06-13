// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

async function member(t: ReturnType<typeof convexTest>, email: string) {
  const userId = await t.run(async (ctx) => ctx.db.insert("users", { email }));
  const as = t.withIdentity({ subject: userId });
  await as.mutation(api.households.createHousehold, { name: email });
  return as;
}

test("cook depletes pantry (clamped), records made-it, and unplans the recipe", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.pantry.adjustPantry, { ingredientId: "beef", deltaG: 500 });
  await a.mutation(api.pantry.adjustPantry, { ingredientId: "egg", deltaG: 100 });
  await a.mutation(api.plan.addToPlan, { recipeId: "r1", scale: 1 });

  await a.mutation(api.cook.cook, {
    recipeId: "r1",
    at: 1000,
    deltas: [
      { ingredientId: "beef", subtract: 200 },
      { ingredientId: "egg", subtract: 1000 },
    ],
  });

  const pantry = await a.query(api.pantry.pantry, {});
  const byId = Object.fromEntries(pantry.map((r) => [r.ingredientId, r.quantityG]));
  expect(byId.beef).toBe(300);
  expect(byId.egg).toBe(0);

  const state = await a.query(api.recipeState.forRecipe, { recipeId: "r1" });
  expect(state).toMatchObject({ madeCount: 1, lastMadeAt: 1000 });

  expect(await a.query(api.plan.plan, {})).toHaveLength(0);
});

test("cook on an unplanned recipe still depletes + records made-it", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.pantry.adjustPantry, { ingredientId: "beef", deltaG: 500 });
  await a.mutation(api.cook.cook, {
    recipeId: "r1",
    at: 1000,
    deltas: [{ ingredientId: "beef", subtract: 100 }],
  });
  expect((await a.query(api.recipeState.forRecipe, { recipeId: "r1" })).madeCount).toBe(1);
  const pantry = await a.query(api.pantry.pantry, {});
  expect(pantry.find((r) => r.ingredientId === "beef")?.quantityG).toBe(400);
});

test("cook rejects a bad timestamp and requires membership", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await expect(
    a.mutation(api.cook.cook, { recipeId: "r1", at: 0, deltas: [] }),
  ).rejects.toThrow(/timestamp/i);
  await expect(
    t.mutation(api.cook.cook, { recipeId: "r1", at: 1000, deltas: [] }),
  ).rejects.toThrow();
});

test("cook increments madeCount across repeated cooks", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.cook.cook, { recipeId: "r1", at: 1000, deltas: [] });
  await a.mutation(api.cook.cook, { recipeId: "r1", at: 2000, deltas: [] });
  const state = await a.query(api.recipeState.forRecipe, { recipeId: "r1" });
  expect(state).toMatchObject({ madeCount: 2, lastMadeAt: 2000 });
});

test("cook rejects a negative subtract (no partial effect)", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.pantry.adjustPantry, { ingredientId: "beef", deltaG: 500 });
  await a.mutation(api.plan.addToPlan, { recipeId: "r1", scale: 1 });
  await expect(
    a.mutation(api.cook.cook, {
      recipeId: "r1",
      at: 1000,
      deltas: [{ ingredientId: "beef", subtract: -10 }],
    }),
  ).rejects.toThrow();
  // transaction rolled back: pantry untouched, recipe still planned, not made
  const pantry = await a.query(api.pantry.pantry, {});
  expect(pantry.find((r) => r.ingredientId === "beef")?.quantityG).toBe(500);
  expect(await a.query(api.plan.plan, {})).toHaveLength(1);
  expect((await a.query(api.recipeState.forRecipe, { recipeId: "r1" })).madeCount).toBe(0);
});

test("cook depletion rounds the remaining quantity to a whole number", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.pantry.adjustPantry, { ingredientId: "i1", deltaG: 500 });
  await a.mutation(api.cook.cook, {
    recipeId: "r1",
    at: Date.now(),
    deltas: [{ ingredientId: "i1", subtract: 120.4 }],
  });
  expect((await a.query(api.pantry.pantry, {}))[0].quantityG).toBe(380);
});
