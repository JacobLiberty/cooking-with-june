import { Suspense } from "react";
import Link from "next/link";
import { client } from "@/sanity/lib/client";
import {
  RECIPES_QUERY,
  INGREDIENTS_QUERY,
  TAGS_QUERY,
} from "@/sanity/lib/queries";
import { getCookableCoverage } from "@/app/actions/kitchen-data";
import type {
  RecipeCardData,
  IngredientOption,
  TagOption,
} from "@/sanity/types";
import { fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@cvx/_generated/api";
import { CollectionView } from "@/components/collection-view";
import { JuneArt } from "@/components/june";
import { PawTrail } from "@/components/paw-trail";
import { getViewer } from "@/lib/viewer";

// Recipe content comes from Sanity; ratings + per-household state are merged from Convex.
type RawRecipe = Omit<
  RecipeCardData,
  "ratingAvg" | "ratingApproved" | "toTry" | "madeCount"
>;

// revalidate removed — getViewer() (Convex auth token) makes this page dynamic

export default async function HomePage() {
  const [rawRecipes, ingredients, tags, viewer] = await Promise.all([
    client.fetch<RawRecipe[]>(RECIPES_QUERY),
    client.fetch<IngredientOption[]>(INGREDIENTS_QUERY),
    client.fetch<TagOption[]>(TAGS_QUERY),
    getViewer(),
  ]);

  const token = viewer.isMember ? await convexAuthNextjsToken() : null;

  // Ratings (global) + per-household made/to-try live in Convex; if it's briefly
  // unreachable, still render the (public) collection rather than 500.
  const [ratingsById, myStates] = await Promise.all([
    fetchQuery(api.ratings.forRecipes, {
      recipeIds: rawRecipes.map((r) => r._id),
    }).catch(
      () =>
        ({}) as Record<
          string,
          { average: number; count: number; approved: boolean }
        >,
    ),
    fetchQuery(api.recipeState.mine, {}, viewer.isMember && token ? { token } : {}).catch(
      () => [] as { recipeId: string; madeCount: number; toTry: boolean }[],
    ),
  ]);
  const stateById = new Map(myStates.map((s) => [s.recipeId, s]));
  const recipes: RecipeCardData[] = rawRecipes.map((r) => {
    const agg = ratingsById[r._id];
    const st = stateById.get(r._id);
    return {
      ...r,
      // Store the precise average (display rounds via roundHalf); sort stays accurate.
      ratingAvg: agg && agg.count > 0 ? agg.average : null,
      ratingApproved: agg?.approved ?? false,
      toTry: st?.toTry ?? false,
      madeCount: st?.madeCount ?? 0,
    };
  });

  // Members get the pantry-aware "What can I cook?" filter — precompute coverage
  // (base scale 1) for every recipe once; the client filters against it instantly.
  const coverage = viewer.isMember
    ? await getCookableCoverage(recipes.map((r) => r._id)).catch(() => undefined)
    : undefined;

  return (
    <section>
      <header className="set set-1">
        <p className="kicker text-terracotta">The collection</p>
        <h1 className="editorial-display mt-2 text-4xl text-ink sm:text-5xl md:text-7xl">
          Cooking with June
        </h1>
        <p className="editorial-aside mt-3 max-w-xl text-lg text-ink-soft sm:text-xl">
          Recipes worth making twice — maintained by Jacob &amp; Lily,
          supervised by June.
        </p>
        <div className="relative mt-5">
          <JuneArt
            pose="peek"
            className="pointer-events-none absolute bottom-0 right-2 h-12 w-auto sm:right-8 sm:h-20"
            priority
          />
          <div className="rule-draw h-px w-full bg-terracotta/40" />
        </div>
        {viewer.isMember ? (
          <div className="mt-4">
            <Link
              href="/recipe/new"
              className="kicker inline-flex items-center gap-1.5 rounded-full border border-terracotta px-4 py-2 text-terracotta transition-colors hover:bg-terracotta hover:text-paper"
            >
              <span aria-hidden>+</span> New recipe
            </Link>
          </div>
        ) : null}
      </header>

      <div className="set set-2 mt-8">
        <Suspense fallback={<PawTrail label="Plating the collection…" />}>
          <CollectionView
            recipes={recipes}
            ingredients={ingredients}
            tags={tags}
            coverage={coverage}
          />
        </Suspense>
      </div>
    </section>
  );
}
