"use client";

import { useCallback, useMemo, useState } from "react";
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
} from "@/lib/recipe-filter";
import { filterCookable } from "@/lib/pantry";
import { parseFilters, serializeFilters } from "@/lib/recipe-query-state";
import { FilterControls } from "@/components/filter-controls";
import { RecipeGrid } from "@/components/recipe-grid";
import { JuneArt } from "@/components/june";

export function CollectionView({
  recipes,
  ingredients,
  tags,
  pantryIds,
}: {
  recipes: RecipeCardData[];
  ingredients: IngredientOption[];
  tags: TagOption[];
  pantryIds?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pantryOnly, setPantryOnly] = useState(false);

  const filters = useMemo(
    () => parseFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const tagCounts = useMemo(() => countByTag(recipes), [recipes]);
  const ingredientCounts = useMemo(
    () => countByIngredientId(recipes),
    [recipes],
  );
  const pantrySet = useMemo(() => new Set(pantryIds ?? []), [pantryIds]);
  const canCookFromPantry = (pantryIds?.length ?? 0) > 0;

  const setFilters = useCallback(
    (next: RecipeFilters) => {
      const qs = serializeFilters(next);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const filtered = useMemo(() => {
    const base = applyRecipeFilters(recipes, filters);
    if (!pantryOnly || !canCookFromPantry) return base;
    // "Cook from pantry" respects the any/all toggle: "all" = have everything,
    // "any" = use at least one pantry item. Ranked by fewest missing.
    return filterCookable(base, pantrySet, filters.mode);
  }, [recipes, filters, pantryOnly, canCookFromPantry, pantrySet]);

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
        onChange={setFilters}
      />

      {canCookFromPantry ? (
        <div className="space-y-2">
          <button
            type="button"
            aria-pressed={pantryOnly}
            onClick={() => setPantryOnly((v) => !v)}
            className={`kicker rounded-full border px-4 py-2 transition-colors ${
              pantryOnly
                ? "border-terracotta bg-terracotta text-paper"
                : "border-terracotta/40 text-terracotta hover:bg-terracotta-wash"
            }`}
          >
            {pantryOnly ? "Cooking from pantry — on" : "Cook from pantry"}
          </button>
          {pantryOnly ? (
            <p className="text-sm text-ink-soft">
              {filters.mode === "all"
                ? "Recipes you have every ingredient for. Set the ingredient match above to “any” to include ones you’re only missing a few of."
                : "Recipes that use anything in your pantry — closest matches first."}
            </p>
          ) : null}
        </div>
      ) : null}

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
