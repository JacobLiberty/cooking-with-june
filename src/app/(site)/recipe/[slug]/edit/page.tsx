import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { client } from "@/sanity/lib/client";
import { RECIPE_EDIT_QUERY, TAGS_QUERY } from "@/sanity/lib/queries";
import type { RecipeEditData, TagOption } from "@/sanity/types";
import { RecipeEditForm } from "@/components/recipe-edit-form";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer.isAuthenticated) redirect("/");
  if (!viewer.isMember) redirect("/household/setup");
  const { slug } = await params;
  const [recipe, tags] = await Promise.all([
    client.withConfig({ useCdn: false }).fetch<RecipeEditData | null>(RECIPE_EDIT_QUERY, { slug }),
    client.fetch<TagOption[]>(TAGS_QUERY),
  ]);
  if (!recipe) notFound();
  return (
    <section className="mx-auto max-w-2xl">
      <h1 className="editorial-display text-4xl text-ink">Edit recipe</h1>
      <div className="mt-6">
        <RecipeEditForm recipe={recipe} tags={tags} />
      </div>
    </section>
  );
}
