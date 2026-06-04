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
        <p className="kicker text-olive">The collection</p>
        <h1 className="editorial-display mt-2 text-5xl text-ink md:text-6xl">
          Cooking with June
        </h1>
        <div className="rule-draw mt-5 h-px w-full bg-olive/40" />
        {viewer.isEditor ? (
          <div className="mt-3">
            <Link href="/recipe/new" className="kicker text-olive hover:text-olive-deep">
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
