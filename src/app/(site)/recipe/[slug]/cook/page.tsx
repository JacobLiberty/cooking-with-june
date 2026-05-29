import { notFound } from "next/navigation";
import { client } from "@/sanity/lib/client";
import { RECIPE_QUERY } from "@/sanity/lib/queries";
import type { RecipeDetailData } from "@/sanity/types";
import { CookMode } from "@/components/cook-mode";

export default async function CookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const recipe = await client.fetch<RecipeDetailData | null>(RECIPE_QUERY, { slug });
  if (!recipe) notFound();

  return (
    <CookMode
      title={recipe.title}
      slug={recipe.slug}
      steps={recipe.steps ?? []}
      ingredients={recipe.ingredients ?? []}
    />
  );
}
