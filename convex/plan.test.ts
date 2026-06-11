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

test("addToPlan inserts one row and is idempotent on (household, recipe)", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.plan.addToPlan, { recipeId: "r1", scale: 2 });
  await a.mutation(api.plan.addToPlan, { recipeId: "r1", scale: 3 });
  const rows = await a.query(api.plan.plan, {});
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ recipeId: "r1", scale: 3 });
});

test("setScale updates the scale; removeFromPlan deletes the row", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.plan.addToPlan, { recipeId: "r1", scale: 1 });
  await a.mutation(api.plan.setScale, { recipeId: "r1", scale: 4 });
  expect((await a.query(api.plan.plan, {}))[0].scale).toBe(4);
  await a.mutation(api.plan.removeFromPlan, { recipeId: "r1" });
  expect(await a.query(api.plan.plan, {})).toHaveLength(0);
});

test("a non-positive scale defaults to 1", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.plan.addToPlan, { recipeId: "r1", scale: 0 });
  expect((await a.query(api.plan.plan, {}))[0].scale).toBe(1);
});

test("plan is scoped to the household and requires membership", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  const b = await member(t, "b@example.com");
  await a.mutation(api.plan.addToPlan, { recipeId: "r1", scale: 1 });
  expect(await b.query(api.plan.plan, {})).toHaveLength(0);
  await expect(
    t.mutation(api.plan.addToPlan, { recipeId: "r1", scale: 1 }),
  ).rejects.toThrow();
});
