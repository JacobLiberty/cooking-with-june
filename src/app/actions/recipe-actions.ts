"use server";

import { revalidatePath } from "next/cache";
import { getWriteClient } from "@/sanity/lib/write-client";
import { client } from "@/sanity/lib/client";
import { requireMember } from "@/lib/viewer";

const reader = () => client.withConfig({ useCdn: false });

// Guard: confirm the id targets an actual recipe before we patch it, so an
// editor can't accidentally (or via a crafted call) mutate a tag/editor/etc.
async function assertRecipe(recipeId: string): Promise<void> {
  const doc = await reader().fetch<{ _type: string } | null>(
    `*[_id == $id][0]{ _type }`,
    { id: recipeId },
  );
  if (doc?._type !== "recipe") {
    throw new Error("Target document is not a recipe");
  }
}

// Recipe ids are Sanity ids; restrict the characters before interpolating one
// into a patch-path string so a crafted id can't inject GROQ into the path.
function safeRecipeId(id: string): string {
  if (typeof id !== "string" || !/^[A-Za-z0-9._-]+$/.test(id)) {
    throw new Error("Invalid recipe id");
  }
  return id;
}

export async function deleteRecipe(
  recipeId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireMember();
  await assertRecipe(recipeId);
  const id = safeRecipeId(recipeId);
  const write = getWriteClient();
  await write.delete(id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export type EditRecipeResult = { ok: true; slug: string } | { ok: false; error: string };

/**
 * Light text-only edit: title, headnote, times, servings, steps, tags. Does NOT
 * touch ingredients/macros/images — ingredient changes go through Re-import.
 */
export async function editRecipeText(
  recipeId: string,
  formData: FormData,
): Promise<EditRecipeResult> {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "Title is required" };

  await requireMember();
  await assertRecipe(recipeId);

  const description = String(formData.get("description") ?? "").trim() || undefined;
  const story = String(formData.get("story") ?? "").trim() || undefined;
  const prepTime = Number(formData.get("prepTime")) || undefined;
  const cookTime = Number(formData.get("cookTime")) || undefined;
  const servings = Number(formData.get("servings")) || undefined;
  const steps = formData.getAll("step").map((s) => String(s).trim()).filter(Boolean);

  const submittedTagIds = formData.getAll("tag").map((t) => String(t));
  const tagIds = submittedTagIds.length
    ? await reader().fetch<string[]>(`*[_type == "tag" && _id in $ids]._id`, {
        ids: submittedTagIds,
      })
    : [];

  const write = getWriteClient();
  await write
    .patch(recipeId)
    .set({
      title,
      description,
      story,
      prepTime,
      cookTime,
      servings,
      steps,
      tags: tagIds.map((id, i) => ({ _type: "reference", _key: `tag-${i}`, _ref: id })),
    })
    .commit();

  const slug = await reader().fetch<string | null>(`*[_id == $id][0].slug.current`, {
    id: recipeId,
  });
  if (!slug) return { ok: false, error: "Recipe not found" };

  revalidatePath("/", "layout");
  revalidatePath(`/recipe/${slug}`);
  return { ok: true, slug };
}
