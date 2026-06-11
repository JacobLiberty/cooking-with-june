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

test("adjustPantry adds, accumulates, and clamps at zero", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.pantry.adjustPantry, { ingredientId: "i1", deltaG: 500 });
  await a.mutation(api.pantry.adjustPantry, { ingredientId: "i1", deltaG: 200 });
  expect((await a.query(api.pantry.pantry, {}))[0].quantityG).toBe(700);
  await a.mutation(api.pantry.adjustPantry, { ingredientId: "i1", deltaG: -1000 });
  expect((await a.query(api.pantry.pantry, {}))[0].quantityG).toBe(0);
});

test("setPantryQuantity sets an absolute value and rejects negatives", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.pantry.setPantryQuantity, { ingredientId: "i1", quantityG: 250 });
  expect((await a.query(api.pantry.pantry, {}))[0].quantityG).toBe(250);
  await expect(
    a.mutation(api.pantry.setPantryQuantity, { ingredientId: "i1", quantityG: -5 }),
  ).rejects.toThrow();
});

test("setRestockOverride stores and clears the override", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.pantry.setRestockOverride, {
    ingredientId: "i1",
    restock: { quantity: 2, unit: "kg" },
  });
  expect((await a.query(api.pantry.pantry, {}))[0].restockOverride).toEqual({
    quantity: 2,
    unit: "kg",
  });
  await a.mutation(api.pantry.setRestockOverride, { ingredientId: "i1" });
  expect((await a.query(api.pantry.pantry, {}))[0].restockOverride).toBeNull();
});

test("pantry is household-scoped and requires membership", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  const b = await member(t, "b@example.com");
  await a.mutation(api.pantry.adjustPantry, { ingredientId: "i1", deltaG: 100 });
  expect(await b.query(api.pantry.pantry, {})).toHaveLength(0);
  await expect(
    t.mutation(api.pantry.adjustPantry, { ingredientId: "i1", deltaG: 1 }),
  ).rejects.toThrow();
});
