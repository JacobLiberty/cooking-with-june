"use server";

import { revalidatePath } from "next/cache";
import { getWriteClient } from "@/sanity/lib/write-client";
import { client } from "@/sanity/lib/client";
import { requireEditor } from "@/lib/viewer";

const PLAN_ID = "mealPlan";
const reader = () => client.withConfig({ useCdn: false });

async function ensurePlan(write: ReturnType<typeof getWriteClient>) {
  await write.createIfNotExists({
    _id: PLAN_ID,
    _type: "mealPlan",
    recipes: [],
    manualItems: [],
    checkedIngredients: [],
  });
}

async function assertRecipe(recipeId: string) {
  const doc = await reader().fetch<{ _type: string } | null>(
    `*[_id == $id][0]{ _type }`,
    { id: recipeId },
  );
  if (doc?._type !== "recipe") throw new Error("Target is not a recipe");
}

export async function addToPlan(recipeId: string) {
  await requireEditor();
  await assertRecipe(recipeId);
  const write = getWriteClient();
  await ensurePlan(write);
  await write
    .patch(PLAN_ID)
    .setIfMissing({ recipes: [] })
    .append("recipes", [
      { _key: recipeId, _type: "reference", _ref: recipeId },
    ])
    .commit();
  revalidatePath("/plan");
  revalidatePath(`/recipe`, "layout");
}

export async function removeFromPlan(recipeId: string) {
  await requireEditor();
  const write = getWriteClient();
  await write
    .patch(PLAN_ID)
    .unset([`recipes[_ref=="${recipeId}"]`])
    .commit();
  revalidatePath("/plan");
  revalidatePath(`/recipe`, "layout");
}

export async function toggleIngredientGot(ingredientId: string) {
  await requireEditor();
  const write = getWriteClient();
  await ensurePlan(write);
  const checked = await reader().fetch<string[] | null>(
    `*[_id == $id][0].checkedIngredients`,
    { id: PLAN_ID },
  );
  const set = new Set(checked ?? []);
  if (set.has(ingredientId)) set.delete(ingredientId);
  else set.add(ingredientId);
  await write.patch(PLAN_ID).set({ checkedIngredients: [...set] }).commit();
  revalidatePath("/plan");
}

export async function addManualItem(name: string) {
  await requireEditor();
  const clean = name.trim();
  if (!clean) return { ok: false, error: "Item is empty" };
  if (clean.length > 120) return { ok: false, error: "Too long (max 120)" };
  const write = getWriteClient();
  await ensurePlan(write);
  await write
    .patch(PLAN_ID)
    .setIfMissing({ manualItems: [] })
    .append("manualItems", [
      { _key: crypto.randomUUID(), _type: "manualGroceryItem", name: clean, gotIt: false },
    ])
    .commit();
  revalidatePath("/plan");
  return { ok: true };
}

export async function toggleManualItem(key: string) {
  await requireEditor();
  const write = getWriteClient();
  const got = await reader().fetch<boolean | null>(
    `*[_id == $id][0].manualItems[_key == $key][0].gotIt`,
    { id: PLAN_ID, key },
  );
  await write
    .patch(PLAN_ID)
    .set({ [`manualItems[_key=="${key}"].gotIt`]: !got })
    .commit();
  revalidatePath("/plan");
}

export async function deleteManualItem(key: string) {
  await requireEditor();
  const write = getWriteClient();
  await write.patch(PLAN_ID).unset([`manualItems[_key=="${key}"]`]).commit();
  revalidatePath("/plan");
}

export async function setAllGot(got: boolean) {
  await requireEditor();
  const write = getWriteClient();
  await ensurePlan(write);
  const plan = await reader().fetch<{
    ingredientIds: string[] | null;
    manualKeys: string[] | null;
  } | null>(
    `*[_id == $id][0]{
      "ingredientIds": recipes[]->ingredients[].ingredient._ref,
      "manualKeys": manualItems[]._key
    }`,
    { id: PLAN_ID },
  );
  const patch = write.patch(PLAN_ID).set({
    checkedIngredients: got ? [...new Set(plan?.ingredientIds ?? [])] : [],
  });
  for (const key of plan?.manualKeys ?? []) {
    patch.set({ [`manualItems[_key=="${key}"].gotIt`]: got });
  }
  await patch.commit();
  revalidatePath("/plan");
}
