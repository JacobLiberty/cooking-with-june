import Link from "next/link";
import type { RecipeCardData } from "@/sanity/types";
import { averageRating } from "@/lib/rating";
import { totalTime } from "@/lib/format";
import { StarRating } from "@/components/star-rating";
import { RecipeCover } from "@/components/recipe-cover";
import { isJuneApproved } from "@/lib/june-approved";
import { JuneApprovedBadge } from "@/components/june-approved-badge";

export function RecipeCard({ recipe }: { recipe: RecipeCardData }) {
  const avg = averageRating(recipe.ratings);
  const time = totalTime(recipe.prepTime, recipe.cookTime);
  const meta = [time, recipe.servings ? `serves ${recipe.servings}` : null]
    .filter(Boolean)
    .join(" · ");
  const approved = isJuneApproved(recipe.ratings);
  const tags = recipe.tags?.slice(0, 2) ?? [];

  return (
    <Link
      href={`/recipe/${recipe.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-ink/10 bg-paper shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-terracotta/40 hover:shadow-md focus-visible:-translate-y-1"
    >
      <div className="relative aspect-4/3 overflow-hidden">
        <RecipeCover
          image={recipe.coverImage}
          title={recipe.title}
          className="transition-transform duration-500 group-hover:scale-[1.04]"
        />
        {approved ? (
          <span className="absolute left-3 top-3 rounded-full bg-paper/90 px-2.5 py-1 shadow-sm backdrop-blur-sm">
            <JuneApprovedBadge />
          </span>
        ) : recipe.wishlist && avg == null ? (
          <span className="kicker absolute right-3 top-3 rounded-full bg-paper/90 px-2.5 py-1 text-terracotta shadow-sm backdrop-blur-sm">
            To try
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        {meta ? <p className="kicker text-ink-soft">{meta}</p> : null}
        <h3 className="editorial-display mt-1.5 text-2xl leading-tight text-ink transition-colors group-hover:text-terracotta">
          {recipe.title}
        </h3>
        {recipe.description ? (
          <p className="mt-2 line-clamp-2 leading-relaxed text-ink-soft">
            {recipe.description}
          </p>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          {avg != null ? (
            <StarRating value={avg} />
          ) : (
            <span className="kicker text-ink-soft/70">Unrated</span>
          )}
          {tags.length ? (
            <span className="flex flex-wrap justify-end gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="kicker rounded-full border border-terracotta/30 px-2 py-0.5 text-terracotta"
                >
                  {t}
                </span>
              ))}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
