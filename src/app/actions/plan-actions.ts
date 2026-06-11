"use server";

import { revalidatePath } from "next/cache";
import { getWriteClient } from "@/sanity/lib/write-client";
import { client } from "@/sanity/lib/client";
import { requireMember } from "@/lib/viewer";
import { groceryAfterRecipeRemoval, ingredientsToSeed } from "@/lib/pantry";
import type { ManualLocation } from "@/sanity/plan-types";

const PLAN_ID = "mealPlan";
const reader = () => client.withConfig({ useCdn: false });

// Sanity document ids and our `crypto.randomUUID()` keys only ever contain
// these characters. Validate before interpolating into a patch-path string so a
// crafted id/key can't inject GROQ into the path.
function safeId(id: string): string {
  if (typeof id !== "string" || !/^[A-Za-z0-9._-]+$/.test(id)) {
    throw new Error("Invalid id");
  }
  return id;
}

async function ensurePlan(write: ReturnType<typeof getWriteClient>) {
  await write.createIfNotExists({
    _id: PLAN_ID,
    _type: "mealPlan",
    recipes: [],
    manualItems: [],
    groceryIngredients: [],
    pantryIngredients: [],
    recipeScales: [],
  });
}

async function assertRecipe(recipeId: string) {
  const doc = await reader().fetch<{ _type: string } | null>(
    `*[_id == $id][0]{ _type }`,
    { id: recipeId },
  );
  if (doc?._type !== "recipe") throw new Error("Target is not a recipe");
}

async function recipeIngredientIds(recipeId: string): Promise<string[]> {
  const ids = await reader().fetch<string[] | null>(
    `*[_id == $id][0].ingredients[].ingredient._ref`,
    { id: recipeId },
  );
  return (ids ?? []).filter(Boolean);
}

/** Read the two id-lists, mutate them in-memory, write both back. */
async function patchLists(
  mutate: (grocery: Set<string>, pantry: Set<string>) => void,
) {
  const write = getWriteClient();
  await ensurePlan(write);
  const plan = await reader().fetch<{
    grocery: string[] | null;
    pantry: string[] | null;
  } | null>(
    `*[_id == $id][0]{ "grocery": groceryIngredients, "pantry": pantryIngredients }`,
    { id: PLAN_ID },
  );
  const grocery = new Set(plan?.grocery ?? []);
  const pantry = new Set(plan?.pantry ?? []);
  mutate(grocery, pantry);
  await write
    .patch(PLAN_ID)
    .set({ groceryIngredients: [...grocery], pantryIngredients: [...pantry] })
    .commit();
}

// ── Recipes ───────────────────────────────────────────────────────────────

export async function addToPlan(recipeId: string, scale = 1) {
  await requireMember();
  const id = safeId(recipeId);
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  await assertRecipe(id);
  const ingredientIds = await recipeIngredientIds(id);
  const write = getWriteClient();
  await ensurePlan(write);
  await write
    .patch(PLAN_ID)
    .setIfMissing({ recipes: [] })
    .append("recipes", [{ _key: id, _type: "reference", _ref: id }])
    .commit();
  // record the serving scale chosen on the recipe page (replace any prior one)
  await write
    .patch(PLAN_ID)
    .setIfMissing({ recipeScales: [] })
    .unset([`recipeScales[_key=="${id}"]`])
    .append("recipeScales", [{ _key: id, _type: "planScale", scale: s }])
    .commit();
  // Seed the grocery list with this recipe's ingredients (skip ones we already
  // have on the list or in the pantry).
  await patchLists((grocery, pantry) => {
    for (const ing of ingredientsToSeed(ingredientIds, grocery, pantry)) {
      grocery.add(ing);
    }
  });
  revalidatePath("/plan");
  revalidatePath(`/recipe`, "layout");
}

export async function removeFromPlan(recipeId: string) {
  await requireMember();
  const id = safeId(recipeId);
  const removedIds = await recipeIngredientIds(id);
  const write = getWriteClient();
  await write
    .patch(PLAN_ID)
    .unset([`recipes[_ref=="${id}"]`, `recipeScales[_key=="${id}"]`])
    .commit();
  // Drop this recipe's grocery items, keeping any a still-planned recipe needs.
  // The pantry is untouched.
  const remaining = await reader().fetch<string[] | null>(
    `*[_id == $id][0].recipes[]->ingredients[].ingredient._ref`,
    { id: PLAN_ID },
  );
  await patchLists((grocery) => {
    const next = groceryAfterRecipeRemoval(
      [...grocery],
      removedIds,
      remaining ?? [],
    );
    grocery.clear();
    for (const x of next) grocery.add(x);
  });
  revalidatePath("/plan");
  revalidatePath(`/recipe`, "layout");
}

/** Re-seed the grocery list from every planned recipe (manual refresh). */
export async function syncGroceryFromRecipes() {
  await requireMember();
  const ids = await reader().fetch<string[] | null>(
    `*[_id == $id][0].recipes[]->ingredients[].ingredient._ref`,
    { id: PLAN_ID },
  );
  await patchLists((grocery, pantry) => {
    for (const ing of ingredientsToSeed(ids ?? [], grocery, pantry)) {
      grocery.add(ing);
    }
  });
  revalidatePath("/plan");
}

// ── Grocery list (auto ingredients) ─────────────────────────────────────────

/** Check off → move from the grocery list into the pantry. */
export async function checkGroceryIngredient(ingredientId: string) {
  await requireMember();
  const id = safeId(ingredientId);
  await patchLists((grocery, pantry) => {
    grocery.delete(id);
    pantry.add(id);
  });
  revalidatePath("/plan");
}

/** Skip → remove from the grocery list (pantry untouched). */
export async function skipGroceryIngredient(ingredientId: string) {
  await requireMember();
  const id = safeId(ingredientId);
  await patchLists((grocery) => {
    grocery.delete(id);
  });
  revalidatePath("/plan");
}

// ── Pantry (auto ingredients) ───────────────────────────────────────────────

/** Used it up — remove from the pantry entirely. */
export async function removePantryIngredient(ingredientId: string) {
  await requireMember();
  const id = safeId(ingredientId);
  await patchLists((_grocery, pantry) => {
    pantry.delete(id);
  });
  revalidatePath("/plan");
}

/** Out of it — move from the pantry back onto the grocery list. */
export async function movePantryIngredientToGrocery(ingredientId: string) {
  await requireMember();
  const id = safeId(ingredientId);
  await patchLists((grocery, pantry) => {
    pantry.delete(id);
    grocery.add(id);
  });
  revalidatePath("/plan");
}

// ── Manual items ────────────────────────────────────────────────────────────

export async function addManualItem(name: string, key: string) {
  await requireMember();
  const k = safeId(key);
  const clean = name.trim();
  if (!clean) return { ok: false, error: "Item is empty" };
  if (clean.length > 120) return { ok: false, error: "Too long (max 120)" };
  const write = getWriteClient();
  await ensurePlan(write);
  await write
    .patch(PLAN_ID)
    .setIfMissing({ manualItems: [] })
    .append("manualItems", [
      { _key: k, _type: "manualGroceryItem", name: clean, location: "grocery" },
    ])
    .commit();
  revalidatePath("/plan");
  return { ok: true };
}

export async function setManualLocation(key: string, location: ManualLocation) {
  await requireMember();
  const k = safeId(key);
  if (location !== "grocery" && location !== "pantry") {
    throw new Error("Invalid location");
  }
  const write = getWriteClient();
  await write
    .patch(PLAN_ID)
    .set({ [`manualItems[_key=="${k}"].location`]: location })
    .commit();
  revalidatePath("/plan");
}

export async function removeManualItem(key: string) {
  await requireMember();
  const k = safeId(key);
  const write = getWriteClient();
  await write.patch(PLAN_ID).unset([`manualItems[_key=="${k}"]`]).commit();
  revalidatePath("/plan");
}
