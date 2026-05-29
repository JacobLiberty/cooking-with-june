import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { client } from "@/sanity/lib/client";
import { INGREDIENTS_QUERY, TAGS_QUERY } from "@/sanity/lib/queries";
import type { IngredientOption, TagOption } from "@/sanity/types";
import { RecipeForm } from "@/components/recipe-form";

export default async function NewRecipePage() {
  const viewer = await getViewer();
  if (!viewer.isEditor) redirect("/");
  const [ingredients, tags] = await Promise.all([
    client.fetch<IngredientOption[]>(INGREDIENTS_QUERY),
    client.fetch<TagOption[]>(TAGS_QUERY),
  ]);
  return (
    <section className="mx-auto max-w-2xl">
      <h1 className="editorial-display text-4xl text-ink">New recipe</h1>
      <div className="mt-6">
        <RecipeForm ingredients={ingredients} tags={tags} />
      </div>
    </section>
  );
}
