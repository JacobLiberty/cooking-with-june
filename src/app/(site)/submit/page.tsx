import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { client } from "@/sanity/lib/client";
import { TAGS_QUERY } from "@/sanity/lib/queries";
import type { TagOption } from "@/sanity/types";
import { recipeToBlurb } from "@/lib/import/recipe-to-blurb";
import { ImportReview } from "@/components/import-review";

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ reimport?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer.isAuthenticated) redirect("/");
  if (!viewer.isMember) redirect("/household/setup");

  const { reimport } = await searchParams;
  const tags = await client.fetch<TagOption[]>(TAGS_QUERY);

  let initialBlurb = "";
  let recipeId: string | undefined;
  if (reimport) {
    const recipe = await client
      .withConfig({ useCdn: false })
      .fetch<{ _id: string; title: string; description?: string; servings?: number; ingredients?: { quantity?: string; unit?: string; optional?: boolean; name?: string | null }[] | null; steps?: string[] | null } | null>(
        `*[_type == "recipe" && _id == $id][0]{ _id, title, description, servings, "ingredients": ingredients[]{ quantity, unit, optional, "name": ingredient->name }, steps }`,
        { id: reimport },
      );
    if (recipe) {
      initialBlurb = recipeToBlurb(recipe);
      recipeId = recipe._id;
    }
  }

  return (
    <section className="mx-auto max-w-2xl">
      <header className="set set-1">
        <p className="kicker text-terracotta">{recipeId ? "Re-import recipe" : "Add a recipe"}</p>
        <h1 className="editorial-display mt-2 text-4xl text-ink md:text-5xl">{recipeId ? "Re-import" : "Submit"}</h1>
        <p className="editorial-aside mt-3 text-ink-soft">
          Paste a recipe and June&rsquo;s kitchen will normalize it: ingredients,
          steps, macros, and a cover.
        </p>
        <div className="rule-draw mt-5 h-px w-full bg-terracotta/40" />
      </header>
      <ImportReview tags={tags} initialBlurb={initialBlurb} recipeId={recipeId} />
    </section>
  );
}
