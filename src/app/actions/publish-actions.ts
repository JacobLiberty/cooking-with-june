"use server";

import { revalidatePath } from "next/cache";
import { getWriteClient } from "@/sanity/lib/write-client";
import { client } from "@/sanity/lib/client";
import { requireMember } from "@/lib/viewer";
import { slugify, uniqueSlug } from "@/lib/slug";
import { getOrCreateEnrichedIngredient } from "@/lib/ingredients/get-or-create";
import { computeDraftMacros } from "@/lib/import/assemble";
import { generateRecipeCover } from "@/lib/import/cover";
import type { RecipeDraft } from "@/lib/import/types";

const reader = () => client.withConfig({ useCdn: false });

export type PublishResult = { ok: true; slug: string } | { ok: false; error: string };

/**
 * Member-gated: turn a reviewed draft into a published recipe. Resolves each
 * ingredient to a catalog id (creating + enriching new ones), recomputes macros
 * server-side from the draft's per-100g nutrients (the client-sent macros are
 * not trusted), writes the recipe, and fires a best-effort async cover.
 */
export async function publishRecipe(
  draft: RecipeDraft,
  opts?: { recipeId?: string },
): Promise<PublishResult> {
  await requireMember();

  const title = draft.title.trim();
  if (!title) return { ok: false, error: "Title is required" };

  const write = getWriteClient();

  // Ingredient lines → catalog refs (create + enrich new ones).
  const ingredients = [];
  for (let i = 0; i < draft.ingredients.length; i++) {
    const line = draft.ingredients[i];
    const name = line.name.trim();
    if (!name) continue;
    const id = await getOrCreateEnrichedIngredient(name);
    ingredients.push({
      _key: `ing-${i}-${id.slice(0, 6)}`,
      _type: "ingredientLine",
      ingredient: { _type: "reference", _ref: id },
      quantity: line.quantity || undefined,
      unit: line.unit || undefined,
      note: line.note || undefined,
      optional: line.optional ? true : undefined,
    });
  }

  // Tags: keep only candidate names that match an existing tag.
  const tagIds = draft.candidateTags.length
    ? await reader().fetch<string[]>(`*[_type == "tag" && name in $names]._id`, {
        names: draft.candidateTags,
      })
    : [];

  // Recompute macros from the draft's ingredients (per-100g × grams).
  const macros = computeDraftMacros(draft.ingredients, draft.servings);

  // Republish over an existing recipe (re-import): patch in place, keep slug +
  // images, don't regenerate the cover.
  if (opts?.recipeId) {
    const existing = await reader().fetch<{ _type: string; slug: string | null } | null>(
      `*[_id == $id][0]{ _type, "slug": slug.current }`,
      { id: opts.recipeId },
    );
    if (!existing || existing._type !== "recipe" || !existing.slug) {
      return { ok: false, error: "Recipe not found" };
    }
    await write
      .patch(opts.recipeId)
      .set({
        title,
        description: draft.description.trim() || undefined,
        story: draft.story?.trim() || undefined,
        prepTime: draft.prepTime,
        cookTime: draft.cookTime,
        servings: draft.servings,
        steps: draft.steps.map((s) => s.trim()).filter(Boolean),
        ingredients,
        tags: tagIds.map((id, i) => ({ _type: "reference", _key: `tag-${i}`, _ref: id })),
        macros: {
          base: macros.base,
          full: macros.full,
          estimated: true,
          computedAt: new Date().toISOString(),
          unparsedLines: macros.unparsedLines,
        },
      })
      .commit();
    revalidatePath("/", "layout");
    revalidatePath(`/recipe/${existing.slug}`);
    return { ok: true, slug: existing.slug };
  }

  const taken = await reader().fetch<string[]>(
    `*[_type == "recipe" && defined(slug.current)].slug.current`,
  );
  // Fall back when a title slugifies to nothing (all punctuation/emoji) so the
  // recipe never lands at a bare "/recipe/".
  const slug = uniqueSlug(slugify(title) || "recipe", taken);

  const created = await write.create({
    _type: "recipe",
    title,
    slug: { _type: "slug", current: slug },
    description: draft.description.trim() || undefined,
    story: draft.story?.trim() || undefined,
    prepTime: draft.prepTime,
    cookTime: draft.cookTime,
    servings: draft.servings,
    steps: draft.steps.map((s) => s.trim()).filter(Boolean),
    ingredients,
    tags: tagIds.map((id, i) => ({ _type: "reference", _key: `tag-${i}`, _ref: id })),
    macros: {
      base: macros.base,
      full: macros.full,
      estimated: true,
      computedAt: new Date().toISOString(),
      unparsedLines: macros.unparsedLines,
    },
  });

  // Best-effort async cover (no manual upload here in 4b T1).
  await generateRecipeCover(created._id, title);

  revalidatePath("/", "layout");
  revalidatePath(`/recipe/${slug}`);
  return { ok: true, slug };
}
