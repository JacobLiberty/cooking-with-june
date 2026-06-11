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

test("rate upserts the caller's rating and aggregates", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  const b = await member(t, "b@example.com");

  await a.mutation(api.ratings.rate, { recipeId: "recipe-1", value: 4 });
  await b.mutation(api.ratings.rate, { recipeId: "recipe-1", value: 2 });
  await a.mutation(api.ratings.rate, { recipeId: "recipe-1", value: 5 }); // overwrite

  const agg = await a.query(api.ratings.forRecipe, { recipeId: "recipe-1" });
  expect(agg).toEqual({ average: 3.5, count: 2, mine: 5, approved: false });
});

test("forRecipe returns zeros and null mine when unrated", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  const agg = await a.query(api.ratings.forRecipe, { recipeId: "none" });
  expect(agg).toEqual({ average: 0, count: 0, mine: null, approved: false });
});

test("rate rejects out-of-range values", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await expect(
    a.mutation(api.ratings.rate, { recipeId: "r", value: 9 }),
  ).rejects.toThrow(/0.*5/);
});

test("rate rejects non-half-star values", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await expect(
    a.mutation(api.ratings.rate, { recipeId: "r", value: 3.3 }),
  ).rejects.toThrow(/half-star/);
});

test("rate requires a household member", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "x@example.com" }),
  );
  // signed in but no household
  await expect(
    t
      .withIdentity({ subject: userId })
      .mutation(api.ratings.rate, { recipeId: "r", value: 3 }),
  ).rejects.toThrow(/household/i);
});

test("approved is true only with 2+ ratings all >= 4.5", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  const b = await member(t, "b@example.com");
  await a.mutation(api.ratings.rate, { recipeId: "r", value: 5 });
  let agg = await a.query(api.ratings.forRecipe, { recipeId: "r" });
  expect(agg.approved).toBe(false); // only one rating
  await b.mutation(api.ratings.rate, { recipeId: "r", value: 4.5 });
  agg = await a.query(api.ratings.forRecipe, { recipeId: "r" });
  expect(agg.approved).toBe(true);
  await b.mutation(api.ratings.rate, { recipeId: "r", value: 4 }); // drops below
  agg = await a.query(api.ratings.forRecipe, { recipeId: "r" });
  expect(agg.approved).toBe(false);
});

test("forRecipes returns a per-recipe aggregate map", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  const b = await member(t, "b@example.com");

  await a.mutation(api.ratings.rate, { recipeId: "r1", value: 4 });
  await b.mutation(api.ratings.rate, { recipeId: "r1", value: 2 });
  await a.mutation(api.ratings.rate, { recipeId: "r2", value: 5 });

  const map = await a.query(api.ratings.forRecipes, {
    recipeIds: ["r1", "r2", "r3"],
  });
  expect(map).toEqual({
    r1: { average: 3, count: 2, approved: false },
    r2: { average: 5, count: 1, approved: false },
    r3: { average: 0, count: 0, approved: false },
  });
});
