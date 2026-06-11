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

test("addManualItem upserts one manual row per ingredient", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.grocery.addManualItem, {
    ingredientId: "i1",
    manualQuantity: { quantity: 2, unit: "lb" },
  });
  await a.mutation(api.grocery.addManualItem, {
    ingredientId: "i1",
    manualQuantity: { quantity: 3, unit: "lb" },
  });
  const rows = await a.query(api.grocery.grocery, {});
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    ingredientId: "i1",
    source: "manual",
    manualQuantity: { quantity: 3, unit: "lb" },
  });
});

test("skip then unskip; clearSkips removes by id", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.grocery.skip, { ingredientId: "i1" });
  await a.mutation(api.grocery.skip, { ingredientId: "i2" });
  expect(await a.query(api.grocery.grocery, {})).toHaveLength(2);
  await a.mutation(api.grocery.unskip, { ingredientId: "i1" });
  expect((await a.query(api.grocery.grocery, {})).map((r) => r.ingredientId)).toEqual(["i2"]);
  await a.mutation(api.grocery.clearSkips, { ingredientIds: ["i2", "nope"] });
  expect(await a.query(api.grocery.grocery, {})).toHaveLength(0);
});

test("skip replaces an existing manual row for the same ingredient (never both)", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.grocery.addManualItem, { ingredientId: "i1" });
  await a.mutation(api.grocery.skip, { ingredientId: "i1" });
  const rows = await a.query(api.grocery.grocery, {});
  expect(rows).toHaveLength(1);
  expect(rows[0].source).toBe("skip");
});

test("removeManualItem does not delete a skip row", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.grocery.skip, { ingredientId: "i1" });
  await a.mutation(api.grocery.removeManualItem, { ingredientId: "i1" });
  expect(await a.query(api.grocery.grocery, {})).toHaveLength(1);
});

test("grocery is household-scoped and requires membership", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  const b = await member(t, "b@example.com");
  await a.mutation(api.grocery.addManualItem, { ingredientId: "i1" });
  expect(await b.query(api.grocery.grocery, {})).toHaveLength(0);
  await expect(
    t.mutation(api.grocery.skip, { ingredientId: "i1" }),
  ).rejects.toThrow();
});
