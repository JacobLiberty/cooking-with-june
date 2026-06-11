import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { client } from "@/sanity/lib/client";
import {
  RECIPE_QUERY,
  RECIPE_SLUGS_QUERY,
} from "@/sanity/lib/queries";
import { PLAN_RECIPE_IDS_QUERY } from "@/sanity/lib/plan-queries";
import type { RecipeDetailData } from "@/sanity/types";
import { totalTime } from "@/lib/format";
import { averageRating } from "@/lib/rating";
import { StarRating } from "@/components/star-rating";
import { RecipeCover } from "@/components/recipe-cover";
import { RecipeIngredients } from "@/components/recipe-ingredients";
import { coverTransitionName } from "@/lib/view-transition";
import { urlForImage } from "@/sanity/lib/image";
import { SITE_URL } from "@/lib/site";
import { JuneArt } from "@/components/june";
import { getViewer } from "@/lib/viewer";
import { EditorActions } from "@/components/editor-actions";
import { isJuneApproved } from "@/lib/june-approved";
import { JuneApprovedBadge } from "@/components/june-approved-badge";
import { ShareButton } from "@/components/share-button";
import { AddNoteForm } from "@/components/add-note-form";
import { AddToPlanButton } from "@/components/add-to-plan-button";
import { DeleteRecipeButton } from "@/components/delete-recipe-button";
import { RecipeMacrosPanel } from "@/components/recipe-macros";

// revalidate removed — getViewer() (Convex auth token) makes this page dynamic

export async function generateStaticParams() {
  const slugs = await client
    .withConfig({ useCdn: false })
    .fetch<{ slug: string }[]>(RECIPE_SLUGS_QUERY);
  return slugs.filter((s) => s.slug).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const recipe = await client.fetch<RecipeDetailData | null>(RECIPE_QUERY, {
    slug,
  });
  if (!recipe) return { title: "Recipe not found" };
  const cover = recipe.images?.[0]
    ? urlForImage(recipe.images[0]).width(1200).height(630).fit("crop").url()
    : undefined;
  return {
    title: recipe.title,
    description: recipe.description,
    openGraph: {
      type: "article",
      title: recipe.title,
      description: recipe.description,
      url: `${SITE_URL}/recipe/${slug}`,
      ...(cover ? { images: [{ url: cover, width: 1200, height: 630 }] } : {}),
    },
    twitter: cover ? { card: "summary_large_image", images: [cover] } : undefined,
  };
}

export default async function RecipePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [recipe, viewer] = await Promise.all([
    client.fetch<RecipeDetailData | null>(RECIPE_QUERY, { slug }),
    getViewer(),
  ]);
  if (!recipe) notFound();

  const plannedIds = viewer.isEditor
    ? await client.withConfig({ useCdn: false }).fetch<string[] | null>(PLAN_RECIPE_IDS_QUERY)
    : null;

  const myRating = viewer.editorId
    ? (recipe.ratings?.find((r) => r._key === `rating-${viewer.editorId}`)?.value ?? null)
    : null;

  const time = totalTime(recipe.prepTime, recipe.cookTime);
  const avg = averageRating(recipe.ratings);
  const ratingCount = recipe.ratings?.length ?? 0;
  const ingredientCount = recipe.ingredients?.length ?? 0;
  const madeCount = recipe.madeCount ?? 0;

  return (
    <article className="mx-auto max-w-3xl">
      <header className="set set-1">
        <h1 className="editorial-display mt-2 text-5xl text-ink md:text-6xl">
          {recipe.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {time ? <span className="kicker text-ink-soft">{time}</span> : null}
          {recipe.servings ? (
            <span className="kicker text-ink-soft">serves {recipe.servings}</span>
          ) : null}
          {ingredientCount ? (
            <span className="kicker text-ink-soft">
              {ingredientCount} ingredient{ingredientCount === 1 ? "" : "s"}
            </span>
          ) : null}
          {avg != null ? (
            <span className="flex items-center gap-2">
              <StarRating value={avg} />
              <span className="kicker text-ink-soft">
                {avg.toFixed(1)}
                {ratingCount > 1 ? ` · ${ratingCount}` : ""}
              </span>
            </span>
          ) : (
            <span className="kicker text-ink-soft">Not yet rated</span>
          )}
          {madeCount > 0 ? (
            <span className="kicker text-ink-soft">
              made {madeCount}×
            </span>
          ) : null}
          {isJuneApproved(recipe.ratings) ? <JuneApprovedBadge /> : null}
        </div>
        <div className="rule-draw mt-5 h-px w-full bg-terracotta/40" />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          {recipe.steps?.length ? (
            <Link
              href={`/recipe/${recipe.slug}/cook`}
              className="kicker flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full bg-terracotta px-6 text-paper transition-colors hover:bg-terracotta-deep sm:w-auto"
            >
              Cook mode <span aria-hidden>→</span>
            </Link>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {viewer.isEditor ? (
              <Link href={`/recipe/${recipe.slug}/edit`} className="kicker text-terracotta hover:text-terracotta-deep">
                Edit
              </Link>
            ) : null}
            {viewer.isEditor ? (
              <AddToPlanButton
                recipeId={recipe._id}
                inPlan={Boolean(plannedIds?.includes(recipe._id))}
              />
            ) : null}
            <ShareButton />
            {viewer.isEditor ? (
              <DeleteRecipeButton recipeId={recipe._id} title={recipe.title} />
            ) : null}
          </div>
        </div>
      </header>

      <div
        className="set set-2 mt-6 aspect-3/2 overflow-hidden border border-ink/15"
        style={{ viewTransitionName: coverTransitionName(recipe._id) }}
      >
        <RecipeCover
          image={recipe.images?.[0]}
          title={recipe.title}
          sizes="(min-width: 768px) 768px, 100vw"
        />
      </div>

      {recipe.description ? (
        <p className="dropcap set set-3 mt-6 text-lg leading-relaxed text-ink">
          {recipe.description}
        </p>
      ) : null}

      {recipe.story ? (
        <p className="editorial-aside mt-5 text-xl text-terracotta">
          {recipe.story}
        </p>
      ) : null}

      <RecipeMacrosPanel macros={recipe.macros} />

      <div className="mt-10 grid gap-10 md:grid-cols-[1fr_1.6fr]">
        <section aria-labelledby="ingredients-heading">
          <h2 id="ingredients-heading" className="kicker text-terracotta">
            Ingredients
          </h2>
          <div className="mt-3">
            <RecipeIngredients
              recipeId={recipe._id}
              baseServings={recipe.servings}
              ingredients={recipe.ingredients ?? []}
            />
          </div>
        </section>

        <section aria-labelledby="steps-heading">
          <h2 id="steps-heading" className="kicker text-terracotta">
            Method
          </h2>
          <ol className="mt-3 space-y-5">
            {recipe.steps?.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="editorial-display text-3xl leading-none text-clay">
                  {i + 1}
                </span>
                <p className="pt-1 leading-relaxed text-ink">{step}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="mt-10 flex justify-center">
        <JuneArt pose="divider" className="h-14 w-auto opacity-90" />
      </div>

      {recipe.ratings?.length ? (
        <section
          className="mt-6 border-t border-terracotta/25 pt-6"
          aria-labelledby="ratings-heading"
        >
          <h2 id="ratings-heading" className="kicker text-terracotta">
            Ratings
          </h2>
          <ul className="mt-3 flex flex-wrap gap-6">
            {recipe.ratings.map((r) => (
              <li key={r._key} className="flex items-center gap-2">
                <span className="kicker text-ink-soft">{r.editor ?? "—"}</span>
                <StarRating value={r.value} />
              </li>
            ))}
          </ul>
          {isJuneApproved(recipe.ratings) ? (
            <p className="mt-3 text-sm text-ink-soft">
              <span className="text-terracotta">June approved</span> means
              everyone who rated it gave 4.5★ or higher.
            </p>
          ) : null}
        </section>
      ) : null}

      {recipe.tags?.length ? (
        <div className="mt-8 flex flex-wrap gap-2">
          {recipe.tags.map((t) => (
            <span
              key={t}
              className="kicker border border-terracotta/40 px-2 py-1 text-terracotta"
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}

      {recipe.notes?.length || viewer.isEditor ? (
        <section
          className="mt-10 border-t border-terracotta/25 pt-6"
          aria-labelledby="notes-heading"
        >
          <h2 id="notes-heading" className="kicker text-terracotta">
            From our kitchen
          </h2>
          {recipe.notes?.length ? (
            <ul className="mt-3 space-y-2">
              {recipe.notes.map((n) => (
                <li key={n._key} className="text-ink">
                  {n.author ? (
                    <span className="kicker mr-2 text-ink-soft">{n.author}</span>
                  ) : null}
                  <span className="italic">{n.text}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {viewer.isEditor ? <AddNoteForm recipeId={recipe._id} /> : null}
        </section>
      ) : null}

      {viewer.isEditor ? (
        <EditorActions
          recipeId={recipe._id}
          initialMyRating={myRating}
          initialWishlist={Boolean(recipe.wishlist)}
        />
      ) : null}
    </article>
  );
}
