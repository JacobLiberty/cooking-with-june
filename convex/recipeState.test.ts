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

test("markMade increments count and records lastMadeAt", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.recipeState.markMade, { recipeId: "r1", at: 1000 });
  await a.mutation(api.recipeState.markMade, { recipeId: "r1", at: 2000 });
  const s = await a.query(api.recipeState.forRecipe, { recipeId: "r1" });
  expect(s).toEqual({ madeCount: 2, lastMadeAt: 2000, toTry: false });
});

test("markMade rejects a non-finite or non-positive timestamp", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await expect(
    a.mutation(api.recipeState.markMade, { recipeId: "r1", at: 0 }),
  ).rejects.toThrow(/timestamp/i);
});

test("unmarkMade floors at zero", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.recipeState.markMade, { recipeId: "r1", at: 1000 });
  await a.mutation(api.recipeState.unmarkMade, { recipeId: "r1" });
  await a.mutation(api.recipeState.unmarkMade, { recipeId: "r1" });
  const s = await a.query(api.recipeState.forRecipe, { recipeId: "r1" });
  expect(s.madeCount).toBe(0);
});

test("setToTry toggles and forRecipe defaults to false", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  expect(
    (await a.query(api.recipeState.forRecipe, { recipeId: "r1" })).toTry,
  ).toBe(false);
  await a.mutation(api.recipeState.setToTry, { recipeId: "r1", value: true });
  expect(
    (await a.query(api.recipeState.forRecipe, { recipeId: "r1" })).toTry,
  ).toBe(true);
  await a.mutation(api.recipeState.setToTry, { recipeId: "r1", value: false });
  expect(
    (await a.query(api.recipeState.forRecipe, { recipeId: "r1" })).toTry,
  ).toBe(false);
});

test("mine returns the household's rows", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await a.mutation(api.recipeState.markMade, { recipeId: "r1", at: 1 });
  await a.mutation(api.recipeState.setToTry, { recipeId: "r2", value: true });
  const rows = await a.query(api.recipeState.mine, {});
  expect(rows).toEqual(
    expect.arrayContaining([
      { recipeId: "r1", madeCount: 1, toTry: false },
      { recipeId: "r2", madeCount: 0, toTry: true },
    ]),
  );
  expect(rows).toHaveLength(2);
});

test("markMade requires a household member", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "x@example.com" }),
  );
  await expect(
    t
      .withIdentity({ subject: userId })
      .mutation(api.recipeState.markMade, { recipeId: "r1", at: 1 }),
  ).rejects.toThrow(/household/i);
});

test("households are isolated", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  const b = await member(t, "b@example.com");
  await a.mutation(api.recipeState.markMade, { recipeId: "r1", at: 1 });
  expect(
    (await b.query(api.recipeState.forRecipe, { recipeId: "r1" })).madeCount,
  ).toBe(0);
});
