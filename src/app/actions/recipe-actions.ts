"use server";

import { revalidatePath } from "next/cache";
import { getWriteClient } from "@/sanity/lib/write-client";
import { client } from "@/sanity/lib/client";
import { requireMember } from "@/lib/viewer";
import { slugify } from "@/lib/slug";
import { getOrCreateEnrichedIngredient } from "@/lib/ingredients/get-or-create";

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

// Find a slug not already in use, appending -2, -3, … on collision.
async function uniqueSlug(base: string): Promise<string> {
  const taken = await reader().fetch<string[]>(
    `*[_type == "recipe" && defined(slug.current)].slug.current`,
  );
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

const PLAN_ID = "mealPlan";

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
  // Detach from the meal plan first: Sanity refuses to delete a document that
  // still has incoming references (the plan's recipes[] array would block it).
  try {
    await write
      .patch(PLAN_ID)
      .unset([`recipes[_ref=="${id}"]`, `recipeScales[_key=="${id}"]`])
      .commit();
  } catch {
    // no plan yet, or this recipe was never planned — nothing to detach
  }
  await write.delete(id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export type SaveRecipeResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

export async function saveRecipe(
  recipeId: string | null,
  formData: FormData,
): Promise<SaveRecipeResult> {
  await requireMember();
  const write = getWriteClient();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "Title is required" };

  const description = String(formData.get("description") ?? "").trim() || undefined;
  const story = String(formData.get("story") ?? "").trim() || undefined;
  const prepTime = Number(formData.get("prepTime")) || undefined;
  const cookTime = Number(formData.get("cookTime")) || undefined;
  const servings = Number(formData.get("servings")) || undefined;

  const steps = formData
    .getAll("step")
    .map((s) => String(s).trim())
    .filter(Boolean);

  // Only keep tag ids that point to real tag documents (drop any forged ids).
  const submittedTagIds = formData.getAll("tag").map((t) => String(t));
  const tagIds = submittedTagIds.length
    ? await reader().fetch<string[]>(
        `*[_type == "tag" && _id in $ids]._id`,
        { ids: submittedTagIds },
      )
    : [];

  // ingredient rows: parallel arrays ingName / ingQty / ingUnit / ingNote / ingOptional
  const names = formData.getAll("ingName").map((n) => String(n).trim());
  const qtys = formData.getAll("ingQty").map((q) => String(q).trim());
  const units = formData.getAll("ingUnit").map((u) => String(u).trim());
  const notes = formData.getAll("ingNote").map((n) => String(n).trim());
  const optionals = formData.getAll("ingOptional").map((o) => String(o));

  const ingredients: {
    _key: string;
    _type: "ingredientLine";
    ingredient: { _type: "reference"; _ref: string };
    quantity?: string;
    unit?: string;
    note?: string;
    optional?: boolean;
  }[] = [];
  for (let i = 0; i < names.length; i++) {
    if (!names[i]) continue;
    const id = await getOrCreateEnrichedIngredient(names[i]);
    ingredients.push({
      _key: `ing-${i}-${id.slice(0, 6)}`,
      _type: "ingredientLine",
      ingredient: { _type: "reference", _ref: id },
      quantity: qtys[i] || undefined,
      unit: units[i] || undefined,
      note: notes[i] || undefined,
      optional: optionals[i] === "true" ? true : undefined,
    });
  }

  // optional cover image (server-side MIME guard — accept attr is client-only)
  const image = formData.get("image");
  let imageField: unknown = undefined;
  if (image instanceof File && image.size > 0) {
    if (!image.type.startsWith("image/")) {
      return { ok: false, error: "Cover photo must be an image file" };
    }
    const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB
    if (image.size > MAX_IMAGE_BYTES) {
      return { ok: false, error: "Cover photo must be under 20 MB" };
    }
    const asset = await write.assets.upload("image", image, {
      filename: image.name,
    });
    imageField = [
      {
        _type: "image",
        _key: "cover",
        asset: { _type: "reference", _ref: asset._id },
      },
    ];
  }

  const doc: { _type: "recipe"; [key: string]: unknown } = {
    _type: "recipe",
    title,
    description,
    story,
    prepTime,
    cookTime,
    servings,
    steps,
    ingredients,
    tags: tagIds.map((id, i) => ({ _type: "reference", _key: `tag-${i}`, _ref: id })),
  };
  if (imageField) doc.images = imageField;

  let slug: string;
  if (recipeId) {
    await assertRecipe(recipeId);
    // edit: field-level patch (omits images when none uploaded, so existing
    // photos + ratings/wishlist/madeCount are preserved)
    await write.patch(recipeId).set(doc).commit();
    const existing = await reader().fetch<string | null>(
      `*[_id == $id][0].slug.current`,
      { id: recipeId },
    );
    if (!existing) return { ok: false, error: "Recipe not found" };
    slug = existing;
  } else {
    slug = await uniqueSlug(slugify(title));
    await write.create({
      ...doc,
      slug: { _type: "slug", current: slug },
    });
  }

  revalidatePath("/", "layout");
  revalidatePath(`/recipe/${slug}`);
  return { ok: true, slug };
}
