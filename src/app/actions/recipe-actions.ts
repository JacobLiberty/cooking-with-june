"use server";

import { revalidatePath } from "next/cache";
import { getWriteClient } from "@/sanity/lib/write-client";
import { client } from "@/sanity/lib/client";
import { getViewer, requireMember } from "@/lib/viewer";
import { slugify } from "@/lib/slug";

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

async function resolveIngredientId(
  write: ReturnType<typeof getWriteClient>,
  name: string,
): Promise<string> {
  const clean = name.trim();
  const existing = await reader().fetch<{ _id: string } | null>(
    `*[_type == "ingredient" && lower(name) == lower($name)][0]{ _id }`,
    { name: clean },
  );
  if (existing?._id) return existing._id;
  const created = await write.create({ _type: "ingredient", name: clean });
  return created._id;
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

export async function toggleWishlist(recipeId: string) {
  await requireMember();
  await assertRecipe(recipeId);
  const write = getWriteClient();
  const current = await reader().fetch<boolean | null>(
    `*[_id == $id][0].wishlist`,
    { id: recipeId },
  );
  await write.patch(recipeId).set({ wishlist: !current }).commit();
  revalidatePath("/", "layout");
}

export async function markMade(recipeId: string, isoNow: string) {
  await requireMember();
  if (Number.isNaN(Date.parse(isoNow))) throw new Error("Invalid timestamp");
  await assertRecipe(recipeId);
  const write = getWriteClient();
  await write
    .patch(recipeId)
    .setIfMissing({ madeCount: 0 })
    .inc({ madeCount: 1 })
    .set({ lastMadeAt: isoNow })
    .commit();
  revalidatePath("/", "layout");
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

// Undo for "Made it": decrement the counter (never below 0). Used by the
// toast's Undo action so a stray tap on Made it is reversible.
export async function unmarkMade(recipeId: string) {
  await requireMember();
  await assertRecipe(recipeId);
  const write = getWriteClient();
  const current = await reader().fetch<number | null>(
    `*[_id == $id][0].madeCount`,
    { id: recipeId },
  );
  const next = Math.max(0, (current ?? 0) - 1);
  await write.patch(recipeId).set({ madeCount: next }).commit();
  revalidatePath("/", "layout");
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
    const id = await resolveIngredientId(write, names[i]);
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
      wishlist: false,
      madeCount: 0,
    });
  }

  revalidatePath("/", "layout");
  revalidatePath(`/recipe/${slug}`);
  return { ok: true, slug };
}

export async function addNote(
  recipeId: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const viewer = await getViewer();
  if (!viewer.isMember) return { ok: false, error: "Not authorized" };
  const author = viewer.name ?? undefined;
  const clean = text.trim();
  if (!clean) return { ok: false, error: "Note is empty" };
  if (clean.length > 500) return { ok: false, error: "Note too long (max 500)" };
  await assertRecipe(recipeId);
  const write = getWriteClient();
  await write
    .patch(recipeId)
    .setIfMissing({ notes: [] })
    .append("notes", [
      {
        _key: crypto.randomUUID(),
        _type: "recipeNote",
        author,
        text: clean,
      },
    ])
    .commit();
  revalidatePath("/", "layout");
  return { ok: true };
}
