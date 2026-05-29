import Link from "next/link";
import type { RecipeCardData } from "@/sanity/types";
import { averageRating } from "@/lib/rating";
import { totalTime } from "@/lib/format";
import { StarRating } from "@/components/star-rating";
import { RecipeCover } from "@/components/recipe-cover";

export function RecipeCard({ recipe }: { recipe: RecipeCardData }) {
  const avg = averageRating(recipe.ratings);
  const time = totalTime(recipe.prepTime, recipe.cookTime);
  const meta = [time, recipe.servings ? `serves ${recipe.servings}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/recipe/${recipe.slug}`}
      className="group block border border-ink/15 bg-paper transition-transform hover:-translate-y-0.5"
    >
      <div className="aspect-[4/3] overflow-hidden border-b border-ink/10">
        <RecipeCover image={recipe.coverImage} title={recipe.title} />
      </div>
      <div className="p-4">
        {meta ? <p className="kicker text-ink-soft">{meta}</p> : null}
        <h3 className="editorial-display mt-1 text-2xl text-ink group-hover:text-heather">
          {recipe.title}
        </h3>
        {recipe.description ? (
          <p className="mt-1 line-clamp-2 text-ink-soft">{recipe.description}</p>
        ) : null}
        <div className="mt-3 flex items-center justify-between">
          {avg != null ? (
            <StarRating value={avg} />
          ) : recipe.wishlist ? (
            <span className="kicker text-heather">To try</span>
          ) : (
            <span />
          )}
          {recipe.tags?.length ? (
            <span className="kicker text-ink-soft">{recipe.tags[0]}</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
