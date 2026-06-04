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
  type RecipeFilters,
} from "@/lib/recipe-filter";
import { parseFilters, serializeFilters } from "@/lib/recipe-query-state";
import { FilterControls } from "@/components/filter-controls";
import { RecipeGrid } from "@/components/recipe-grid";
import { JuneArt } from "@/components/june";

export function CollectionView({
  recipes,
  ingredients,
  tags,
}: {
  recipes: RecipeCardData[];
  ingredients: IngredientOption[];
  tags: TagOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => parseFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const setFilters = useCallback(
    (next: RecipeFilters) => {
      const qs = serializeFilters(next);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const filtered = useMemo(
    () => applyRecipeFilters(recipes, filters),
    [recipes, filters],
  );

  const surprise = useCallback(() => {
    if (filtered.length === 0) return;
    // index varies by list identity; deterministic-enough for a fun pick
    const pick = filtered[Math.floor((Date.now() / 1000) % filtered.length)];
    router.push(`/recipe/${pick.slug}`);
  }, [filtered, router]);

  return (
    <div className="space-y-8">
      <FilterControls
        filters={filters}
        ingredients={ingredients}
        tags={tags}
        onChange={setFilters}
      />

      <div className="flex items-center justify-between border-t border-olive/25 pt-4">
        <span className="kicker text-ink-soft" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "recipe" : "recipes"}
        </span>
        <button
          type="button"
          onClick={surprise}
          disabled={filtered.length === 0}
          className="kicker text-olive hover:text-olive-deep disabled:opacity-40"
        >
          Surprise me
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <JuneArt pose="sleeping" className="h-28 w-auto opacity-90" />
          <p className="editorial-display text-2xl text-ink">Nothing here</p>
          <p className="text-ink-soft">
            Try a different search, fewer filters, or switch the pantry match to
            &ldquo;any.&rdquo;
          </p>
        </div>
      ) : (
        <RecipeGrid recipes={filtered} />
      )}
    </div>
  );
}
