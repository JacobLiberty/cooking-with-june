// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

async function member(
  t: ReturnType<typeof convexTest>,
  email: string,
  name?: string,
) {
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email, ...(name ? { name } : {}) }),
  );
  const as = t.withIdentity({ subject: userId });
  await as.mutation(api.households.createHousehold, { name: email });
  return as;
}

test("add inserts an author-attributed note and forRecipe lists it", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com", "Jacob");
  await a.mutation(api.notes.add, { recipeId: "r1", text: "We doubled the garlic" });
  const notes = await a.query(api.notes.forRecipe, { recipeId: "r1" });
  expect(notes).toHaveLength(1);
  expect(notes[0]).toMatchObject({ author: "Jacob", text: "We doubled the garlic" });
});

test("add rejects empty and over-long notes", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  await expect(
    a.mutation(api.notes.add, { recipeId: "r1", text: "   " }),
  ).rejects.toThrow(/empty/i);
  await expect(
    a.mutation(api.notes.add, { recipeId: "r1", text: "x".repeat(501) }),
  ).rejects.toThrow(/500/);
});

test("add requires a household member", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", { email: "x@example.com" }),
  );
  await expect(
    t.withIdentity({ subject: userId }).mutation(api.notes.add, {
      recipeId: "r1",
      text: "hi",
    }),
  ).rejects.toThrow(/household/i);
});

test("households cannot see each other's notes", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  const b = await member(t, "b@example.com");
  await a.mutation(api.notes.add, { recipeId: "r1", text: "secret" });
  expect(await b.query(api.notes.forRecipe, { recipeId: "r1" })).toHaveLength(0);
});

test("remove deletes own note but rejects another household's note", async () => {
  const t = convexTest(schema, modules);
  const a = await member(t, "a@example.com");
  const b = await member(t, "b@example.com");
  await a.mutation(api.notes.add, { recipeId: "r1", text: "mine" });
  const [note] = await a.query(api.notes.forRecipe, { recipeId: "r1" });

  await expect(
    b.mutation(api.notes.remove, { noteId: note._id }),
  ).rejects.toThrow(/not found|authorized/i);

  await a.mutation(api.notes.remove, { noteId: note._id });
  expect(await a.query(api.notes.forRecipe, { recipeId: "r1" })).toHaveLength(0);
});
