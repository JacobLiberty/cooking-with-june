import { Suspense } from "react";
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

export const revalidate = 60;

export default async function HomePage() {
  const [recipes, ingredients, tags] = await Promise.all([
    client.fetch<RecipeCardData[]>(RECIPES_QUERY),
    client.fetch<IngredientOption[]>(INGREDIENTS_QUERY),
    client.fetch<TagOption[]>(TAGS_QUERY),
  ]);

  return (
    <section>
      <header className="set set-1">
        <p className="kicker text-heather">The collection</p>
        <h1 className="editorial-display mt-2 text-5xl text-ink md:text-6xl">
          Cooking with June
        </h1>
        <div className="rule-draw mt-5 h-px w-full bg-heather/40" />
      </header>

      <div className="set set-2 mt-8">
        <Suspense fallback={null}>
          <CollectionView recipes={recipes} ingredients={ingredients} tags={tags} />
        </Suspense>
      </div>
    </section>
  );
}
