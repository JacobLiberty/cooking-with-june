"use server";

import { revalidatePath } from "next/cache";
import { getWriteClient } from "@/sanity/lib/write-client";
import { client } from "@/sanity/lib/client";
import { requireEditor } from "@/lib/viewer";
import { upsertRating, type StoredRating } from "@/lib/rating-mutate";
import { slugify } from "@/lib/slug";

async function resolveIngredientId(
  write: ReturnType<typeof getWriteClient>,
  name: string,
): Promise<string> {
  const clean = name.trim();
  const existing = await client
    .withConfig({ useCdn: false })
    .fetch<{ _id: string } | null>(
      `*[_type == "ingredient" && lower(name) == lower($name)][0]{ _id }`,
      { name: clean },
    );
  if (existing?._id) return existing._id;
  const created = await write.create({ _type: "ingredient", name: clean });
  return created._id;
}

export async function rateRecipe(recipeId: string, value: number) {
  const { editorId } = await requireEditor();
  if (value < 0 || value > 5) throw new Error("Rating must be 0–5");
  const write = getWriteClient();
  const current = await client
    .withConfig({ useCdn: false })
    .fetch<StoredRating[] | null>(`*[_id == $id][0].ratings`, { id: recipeId });
  const next = upsertRating(current ?? [], editorId, value);
  await write.patch(recipeId).set({ ratings: next }).commit();
  revalidatePath("/", "layout");
}

export async function toggleWishlist(recipeId: string) {
  await requireEditor();
  const write = getWriteClient();
  const current = await client
    .withConfig({ useCdn: false })
    .fetch<boolean | null>(`*[_id == $id][0].wishlist`, { id: recipeId });
  await write.patch(recipeId).set({ wishlist: !current }).commit();
  revalidatePath("/", "layout");
}

export async function markMade(recipeId: string, isoNow: string) {
  await requireEditor();
  const write = getWriteClient();
  await write
    .patch(recipeId)
    .setIfMissing({ madeCount: 0 })
    .inc({ madeCount: 1 })
    .set({ lastMadeAt: isoNow })
    .commit();
  revalidatePath("/", "layout");
}

export type SaveRecipeResult = { ok: true; slug: string } | { ok: false; error: string };

export async function saveRecipe(
  recipeId: string | null,
  formData: FormData,
): Promise<SaveRecipeResult> {
  await requireEditor();
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

  const tagIds = formData.getAll("tag").map((t) => String(t));

  // ingredient rows: parallel arrays ingName / ingQty / ingUnit
  const names = formData.getAll("ingName").map((n) => String(n).trim());
  const qtys = formData.getAll("ingQty").map((q) => String(q).trim());
  const units = formData.getAll("ingUnit").map((u) => String(u).trim());

  const ingredients: {
    _key: string;
    _type: "ingredientLine";
    ingredient: { _type: "reference"; _ref: string };
    quantity?: string;
    unit?: string;
  }[] = [];
  for (let i = 0; i < names.length; i++) {
    if (!names[i]) continue;
    const id = await resolveIngredientId(write, names[i]);
    ingredients.push({
      _key: `ing-${i}-${id.slice(0, 6)}`,
      _type: "ingredientLine",
      ingredient: { _type: "reference", _ref: id },
      quantity: qtys[i] || undefined,
      unit: units[i] || undefined,
    });
  }

  // optional cover image
  const image = formData.get("image");
  let imageField: unknown = undefined;
  if (image instanceof File && image.size > 0) {
    const asset = await write.assets.upload("image", image, {
      filename: image.name,
    });
    imageField = [
      { _type: "image", _key: "cover", asset: { _type: "reference", _ref: asset._id } },
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
    // edit: patch fields (don't clobber images if none uploaded)
    const patch = write.patch(recipeId).set(doc);
    await patch.commit();
    const existing = await client
      .withConfig({ useCdn: false })
      .fetch<string>(`*[_id == $id][0].slug.current`, { id: recipeId });
    slug = existing;
  } else {
    slug = slugify(title);
    await write.create({
      ...doc,
      slug: { _type: "slug", current: slug },
      wishlist: false,
      madeCount: 0,
    });
  }

  revalidatePath("/", "layout");
  revalidatePath(`/recipe/${slug}`);
  return { ok: true, slug };
}
