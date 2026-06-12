"use client";

import { useCallback, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type {
  RecipeCardData,
  IngredientOption,
  TagOption,
} from "@/sanity/types";
import {
  applyRecipeFilters,
  countByTag,
  countByIngredientId,
  type RecipeFilters,
  type CoverageMap,
} from "@/lib/recipe-filter";
import { parseFilters, serializeFilters } from "@/lib/recipe-query-state";
import { FilterControls } from "@/components/filter-controls";
import { RecipeGrid } from "@/components/recipe-grid";
import { JuneArt } from "@/components/june";

export function CollectionView({
  recipes,
  ingredients,
  tags,
  coverage,
}: {
  recipes: RecipeCardData[];
  ingredients: IngredientOption[];
  tags: TagOption[];
  coverage?: CoverageMap;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => parseFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const tagCounts = useMemo(() => countByTag(recipes), [recipes]);
  const ingredientCounts = useMemo(() => countByIngredientId(recipes), [recipes]);

  const setFilters = useCallback(
    (next: RecipeFilters) => {
      const qs = serializeFilters(next);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const filtered = useMemo(
    // Without coverage (e.g. signed out, or a shared ?cook= link) the cookable
    // control is hidden, so ignore any cook= param rather than empty the grid.
    () =>
      applyRecipeFilters(
        recipes,
        coverage ? filters : { ...filters, cookable: "off" },
        coverage,
      ),
    [recipes, filters, coverage],
  );

  const surprise = useCallback(() => {
    if (filtered.length === 0) return;
    const pick = filtered[Math.floor(Math.random() * filtered.length)];
    router.push(`/recipe/${pick.slug}`);
  }, [filtered, router]);

  return (
    <div className="space-y-8">
      <FilterControls
        filters={filters}
        ingredients={ingredients}
        tags={tags}
        tagCounts={tagCounts}
        ingredientCounts={ingredientCounts}
        showCookable={Boolean(coverage)}
        onChange={setFilters}
      />

      <div className="flex items-center justify-between border-t border-terracotta/25 pt-4">
        <span className="kicker text-ink-soft" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "recipe" : "recipes"}
        </span>
        <button
          type="button"
          onClick={surprise}
          disabled={filtered.length === 0}
          className="kicker text-terracotta hover:text-terracotta-deep disabled:opacity-40"
        >
          Surprise me
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <JuneArt pose="sleeping" className="h-28 w-auto opacity-90" />
          {recipes.length === 0 ? (
            <>
              <p className="editorial-display text-2xl text-ink">No recipes yet</p>
              <p className="text-ink-soft">
                June&rsquo;s kitchen is empty for now. Add the first recipe and
                it&rsquo;ll show up here.
              </p>
            </>
          ) : (
            <>
              <p className="editorial-display text-2xl text-ink">Nothing here</p>
              <p className="text-ink-soft">
                Try a different search, fewer filters, or widen &ldquo;What can I
                cook?&rdquo; to allow a few missing ingredients.
              </p>
            </>
          )}
        </div>
      ) : (
        <RecipeGrid recipes={filtered} />
      )}
    </div>
  );
}
