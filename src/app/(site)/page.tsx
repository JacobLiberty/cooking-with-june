import { Suspense } from "react";
import Link from "next/link";
import { client } from "@/sanity/lib/client";
import {
  RECIPES_QUERY,
  INGREDIENTS_QUERY,
  TAGS_QUERY,
} from "@/sanity/lib/queries";
import type {
  RecipeCardData,
  IngredientOption,
  TagOption,
} from "@/sanity/types";
import { CollectionView } from "@/components/collection-view";
import { JuneArt } from "@/components/june";
import { getViewer } from "@/lib/viewer";

// revalidate removed — getViewer() (auth()) makes this page dynamic

export default async function HomePage() {
  const [recipes, ingredients, tags, viewer] = await Promise.all([
    client.fetch<RecipeCardData[]>(RECIPES_QUERY),
    client.fetch<IngredientOption[]>(INGREDIENTS_QUERY),
    client.fetch<TagOption[]>(TAGS_QUERY),
    getViewer(),
  ]);

  return (
    <section>
      <header className="set set-1">
        <p className="kicker text-terracotta">The collection</p>
        <h1 className="editorial-display mt-2 text-5xl text-ink md:text-6xl">
          Cooking with June
        </h1>
        <div className="relative mt-5">
          <JuneArt
            pose="peek"
            className="pointer-events-none absolute bottom-0 right-2 h-16 w-auto sm:right-8 sm:h-20"
            priority
          />
          <div className="rule-draw h-px w-full bg-terracotta/40" />
        </div>
        {viewer.isEditor ? (
          <div className="mt-3">
            <Link href="/recipe/new" className="kicker text-terracotta hover:text-terracotta-deep">
              New recipe
            </Link>
          </div>
        ) : null}
      </header>

      <div className="set set-2 mt-8">
        <Suspense fallback={null}>
          <CollectionView recipes={recipes} ingredients={ingredients} tags={tags} />
        </Suspense>
      </div>
    </section>
  );
}
