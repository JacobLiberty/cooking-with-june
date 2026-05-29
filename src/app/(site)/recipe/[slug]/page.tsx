import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { client } from "@/sanity/lib/client";
import {
  RECIPE_QUERY,
  RECIPE_SLUGS_QUERY,
} from "@/sanity/lib/queries";
import type { RecipeDetailData } from "@/sanity/types";
import { totalTime } from "@/lib/format";
import { StarRating } from "@/components/star-rating";
import { RecipeCover } from "@/components/recipe-cover";

export const revalidate = 60;

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
  if (!recipe) return { title: "Recipe not found · Cooking with June" };
  return {
    title: `${recipe.title} · Cooking with June`,
    description: recipe.description,
  };
}

export default async function RecipePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const recipe = await client.fetch<RecipeDetailData | null>(RECIPE_QUERY, {
    slug,
  });
  if (!recipe) notFound();

  const time = totalTime(recipe.prepTime, recipe.cookTime);
  const meta = [time, recipe.servings ? `serves ${recipe.servings}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="mx-auto max-w-3xl">
      <header className="set set-1">
        {meta ? <p className="kicker text-heather">{meta}</p> : null}
        <h1 className="editorial-display mt-2 text-5xl text-ink md:text-6xl">
          {recipe.title}
        </h1>
        <div className="rule-draw mt-5 h-px w-full bg-heather/40" />
      </header>

      <div className="set set-2 mt-6 aspect-3/2 overflow-hidden border border-ink/15">
        <RecipeCover image={recipe.images?.[0]} title={recipe.title} />
      </div>

      {recipe.description ? (
        <p className="dropcap set set-3 mt-6 text-lg leading-relaxed text-ink">
          {recipe.description}
        </p>
      ) : null}

      {recipe.story ? (
        <p className="editorial-aside mt-5 text-xl text-heather">
          {recipe.story}
        </p>
      ) : null}

      <div className="mt-10 grid gap-10 md:grid-cols-[1fr_1.6fr]">
        <section aria-labelledby="ingredients-heading">
          <h2 id="ingredients-heading" className="kicker text-heather">
            Ingredients
          </h2>
          <ul className="mt-3 space-y-2 [font-variant-numeric:tabular-nums]">
            {recipe.ingredients?.map((line) => (
              <li key={line._key} className="flex gap-2 border-b border-ink/10 pb-2">
                <span className="text-ink-soft">
                  {[line.quantity, line.unit].filter(Boolean).join(" ")}
                </span>
                <span className="text-ink">
                  {line.name ?? "—"}
                  {line.note ? (
                    <span className="italic text-ink-soft"> ({line.note})</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="steps-heading">
          <h2 id="steps-heading" className="kicker text-heather">
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

      {recipe.ratings?.length ? (
        <section
          className="mt-10 border-t border-heather/25 pt-6"
          aria-labelledby="ratings-heading"
        >
          <h2 id="ratings-heading" className="kicker text-heather">
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
        </section>
      ) : null}

      {recipe.tags?.length ? (
        <div className="mt-8 flex flex-wrap gap-2">
          {recipe.tags.map((t) => (
            <span
              key={t}
              className="kicker border border-heather/40 px-2 py-1 text-heather"
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}
