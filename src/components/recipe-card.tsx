import Link from "next/link";
import type { RecipeCardData } from "@/sanity/types";
import { totalTime } from "@/lib/format";
import { roundHalf } from "@/lib/rating-format";
import { StarRating } from "@/components/star-rating";
import { RecipeCover } from "@/components/recipe-cover";
import { coverTransitionName } from "@/lib/view-transition";
import { JuneApprovedBadge } from "@/components/june-approved-badge";

export function RecipeCard({ recipe }: { recipe: RecipeCardData }) {
  const avg = roundHalf(recipe.ratingAvg);
  const time = totalTime(recipe.prepTime, recipe.cookTime);
  const meta = [time, recipe.servings ? `serves ${recipe.servings}` : null]
    .filter(Boolean)
    .join(" · ");
  const approved = recipe.ratingApproved;
  const tags = recipe.tags?.slice(0, 2) ?? [];

  return (
    <Link
      href={`/recipe/${recipe.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-ink/10 bg-paper shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-terracotta/40 hover:shadow-md focus-visible:-translate-y-1"
    >
      <div
        className="relative aspect-4/3 overflow-hidden"
        style={{ viewTransitionName: coverTransitionName(recipe._id) }}
      >
        <RecipeCover
          image={recipe.coverImage}
          title={recipe.title}
          className="transition-transform duration-500 group-hover:scale-[1.04]"
        />
        {approved ? (
          <span className="absolute left-3 top-3 inline-flex h-7 items-center rounded-full bg-paper px-2.5 shadow-sm">
            <JuneApprovedBadge />
          </span>
        ) : null}
        {recipe.toTry ? (
          <span className="kicker absolute right-3 top-3 inline-flex h-7 items-center rounded-full bg-paper px-2.5 text-terracotta shadow-sm">
            To try
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        {meta ? <p className="kicker text-ink-soft">{meta}</p> : null}
        <h3 className="editorial-display mt-1.5 text-2xl leading-tight text-ink transition-colors group-hover:text-terracotta">
          {recipe.title}
        </h3>
        <div className="mt-2 flex h-5 items-center gap-2.5">
          {avg != null ? (
            <StarRating value={avg} />
          ) : recipe.toTry ? null : (
            <span className="kicker text-ink-soft">Unrated</span>
          )}
          {recipe.madeCount ? (
            <span className="kicker text-ink-soft">made {recipe.madeCount}×</span>
          ) : null}
        </div>
        {recipe.description ? (
          <p className="mt-1 line-clamp-2 leading-relaxed text-ink-soft">
            {recipe.description}
          </p>
        ) : null}
        {tags.length ? (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
            {tags.map((t) => (
              <span
                key={t}
                className="kicker border border-terracotta/40 px-2 py-0.5 text-terracotta"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
