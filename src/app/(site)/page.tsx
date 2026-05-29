import { client } from "@/sanity/lib/client";
import { RECIPES_QUERY } from "@/sanity/lib/queries";
import type { RecipeCardData } from "@/sanity/types";
import { RecipeGrid } from "@/components/recipe-grid";
import { PawMark } from "@/components/paw-mark";

export const revalidate = 60;

export default async function HomePage() {
  const recipes = await client.fetch<RecipeCardData[]>(RECIPES_QUERY);

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
        {recipes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <PawMark className="h-8 w-8 text-clay/70" />
            <p className="editorial-display text-2xl text-ink">
              No recipes yet
            </p>
            <p className="text-ink-soft">
              June is still deciding what to cook first.
            </p>
          </div>
        ) : (
          <RecipeGrid recipes={recipes} />
        )}
      </div>
    </section>
  );
}
