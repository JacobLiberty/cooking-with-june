"use server";

import { revalidatePath } from "next/cache";
import { getWriteClient } from "@/sanity/lib/write-client";
import { client } from "@/sanity/lib/client";
import { requireEditor } from "@/lib/viewer";

const PLAN_ID = "mealPlan";
const reader = () => client.withConfig({ useCdn: false });

// Sanity document ids and our `crypto.randomUUID()` keys only ever contain these
// characters. Validate before interpolating into a patch-path string so a crafted
// id/key can't inject GROQ into the path (e.g. break out of the `==` filter).
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
  const id = safeId(recipeId);
  await assertRecipe(id);
  const write = getWriteClient();
  await ensurePlan(write);
  await write
    .patch(PLAN_ID)
    .setIfMissing({ recipes: [] })
    .append("recipes", [{ _key: id, _type: "reference", _ref: id }])
    .commit();
  revalidatePath("/plan");
  revalidatePath(`/recipe`, "layout");
}

export async function removeFromPlan(recipeId: string) {
  await requireEditor();
  const id = safeId(recipeId);
  const write = getWriteClient();
  await write
    .patch(PLAN_ID)
    .unset([`recipes[_ref=="${id}"]`])
    .commit();
  // Prune any checked/skipped ids no longer produced by a remaining recipe so
  // they don't reappear pre-checked if the same ingredient returns later.
  const plan = await reader().fetch<{
    live: string[] | null;
    checked: string[] | null;
    removed: string[] | null;
  } | null>(
    `*[_id == $id][0]{
      "live": recipes[]->ingredients[].ingredient._ref,
      "checked": checkedIngredients,
      "removed": removedIngredients
    }`,
    { id: PLAN_ID },
  );
  const live = new Set(plan?.live ?? []);
  await write
    .patch(PLAN_ID)
    .set({
      checkedIngredients: (plan?.checked ?? []).filter((x) => live.has(x)),
      removedIngredients: (plan?.removed ?? []).filter((x) => live.has(x)),
    })
    .commit();
  revalidatePath("/plan");
  revalidatePath(`/recipe`, "layout");
}

export async function toggleIngredientGot(ingredientId: string) {
  await requireEditor();
  const id = safeId(ingredientId);
  const write = getWriteClient();
  await ensurePlan(write);
  const plan = await reader().fetch<{
    checked: string[] | null;
    removed: string[] | null;
  } | null>(
    `*[_id == $id][0]{ "checked": checkedIngredients, "removed": removedIngredients }`,
    { id: PLAN_ID },
  );
  const checked = new Set(plan?.checked ?? []);
  const removed = new Set(plan?.removed ?? []);
  if (checked.has(id)) {
    checked.delete(id);
  } else {
    checked.add(id);
    removed.delete(id); // got and not-getting are mutually exclusive
  }
  await write
    .patch(PLAN_ID)
    .set({ checkedIngredients: [...checked], removedIngredients: [...removed] })
    .commit();
  revalidatePath("/plan");
}

async function setMembership(
  field: "checkedIngredients" | "removedIngredients",
  id: string,
  present: boolean,
) {
  const write = getWriteClient();
  await ensurePlan(write);
  const current = await reader().fetch<string[] | null>(
    `*[_id == $id][0][$field]`,
    { id: PLAN_ID, field },
  );
  const set = new Set(current ?? []);
  if (present) set.add(id);
  else set.delete(id);
  await write.patch(PLAN_ID).set({ [field]: [...set] }).commit();
}

/** Skip an auto ingredient ("not getting it") — hide from the to-get list.
 *  Also clears any "got" flag so the two states stay mutually exclusive. */
export async function skipIngredient(ingredientId: string) {
  await requireEditor();
  const id = safeId(ingredientId);
  const write = getWriteClient();
  await ensurePlan(write);
  const plan = await reader().fetch<{
    checked: string[] | null;
    removed: string[] | null;
  } | null>(
    `*[_id == $id][0]{ "checked": checkedIngredients, "removed": removedIngredients }`,
    { id: PLAN_ID },
  );
  const checked = new Set(plan?.checked ?? []);
  const removed = new Set(plan?.removed ?? []);
  checked.delete(id);
  removed.add(id);
  await write
    .patch(PLAN_ID)
    .set({ checkedIngredients: [...checked], removedIngredients: [...removed] })
    .commit();
  revalidatePath("/plan");
}

/** Restore a previously-skipped ingredient back to the to-get list. */
export async function unskipIngredient(ingredientId: string) {
  await requireEditor();
  await setMembership("removedIngredients", safeId(ingredientId), false);
  revalidatePath("/plan");
}

export async function addManualItem(name: string, key: string) {
  await requireEditor();
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
      { _key: k, _type: "manualGroceryItem", name: clean, gotIt: false },
    ])
    .commit();
  revalidatePath("/plan");
  return { ok: true };
}

export async function toggleManualItem(key: string) {
  await requireEditor();
  const k = safeId(key);
  const write = getWriteClient();
  const got = await reader().fetch<boolean | null>(
    `*[_id == $id][0].manualItems[_key == $key][0].gotIt`,
    { id: PLAN_ID, key: k },
  );
  await write
    .patch(PLAN_ID)
    .set({ [`manualItems[_key=="${k}"].gotIt`]: !got })
    .commit();
  revalidatePath("/plan");
}

export async function deleteManualItem(key: string) {
  await requireEditor();
  const k = safeId(key);
  const write = getWriteClient();
  await write.patch(PLAN_ID).unset([`manualItems[_key=="${k}"]`]).commit();
  revalidatePath("/plan");
}

export async function setAllGot(got: boolean) {
  await requireEditor();
  const write = getWriteClient();
  await ensurePlan(write);
  const plan = await reader().fetch<{
    ingredientIds: string[] | null;
    manualKeys: string[] | null;
    removed: string[] | null;
  } | null>(
    `*[_id == $id][0]{
      "ingredientIds": recipes[]->ingredients[].ingredient._ref,
      "manualKeys": manualItems[]._key,
      "removed": removedIngredients
    }`,
    { id: PLAN_ID },
  );
  // Mark everything got EXCEPT ingredients the user chose to skip — mirrors the
  // UI's "to-get" set so server truth doesn't disagree with the optimistic view.
  const removed = new Set(plan?.removed ?? []);
  const patch = write.patch(PLAN_ID).set({
    checkedIngredients: got
      ? [...new Set(plan?.ingredientIds ?? [])].filter((id) => !removed.has(id))
      : [],
  });
  for (const key of plan?.manualKeys ?? []) {
    if (!/^[A-Za-z0-9._-]+$/.test(key)) continue; // defense-in-depth on stored keys
    patch.set({ [`manualItems[_key=="${key}"].gotIt`]: got });
  }
  await patch.commit();
  revalidatePath("/plan");
}
