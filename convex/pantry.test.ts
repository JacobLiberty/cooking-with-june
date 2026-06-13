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

test("pantry writes round to whole numbers", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.pantry.adjustPantry, { ingredientId: "i1", deltaG: 250.4 });
  expect((await a.query(api.pantry.pantry, {}))[0].quantityG).toBe(250);
  await a.mutation(api.pantry.setPantryQuantity, { ingredientId: "i1", quantityG: 99.6 });
  expect((await a.query(api.pantry.pantry, {}))[0].quantityG).toBe(100);
});

test("depleteItem removes the row and is idempotent", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.pantry.adjustPantry, { ingredientId: "i1", deltaG: 100 });
  await a.mutation(api.pantry.depleteItem, { ingredientId: "i1" });
  expect(await a.query(api.pantry.pantry, {})).toHaveLength(0);
  // second call is a no-op, not an error
  await a.mutation(api.pantry.depleteItem, { ingredientId: "i1" });
  expect(await a.query(api.pantry.pantry, {})).toHaveLength(0);
});

test("depleteItem requires membership", async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.mutation(api.pantry.depleteItem, { ingredientId: "i1" }),
  ).rejects.toThrow();
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
