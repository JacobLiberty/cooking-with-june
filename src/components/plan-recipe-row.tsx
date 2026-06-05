import Link from "next/link";
import type { PlanRecipe } from "@/sanity/plan-types";
import { totalTime } from "@/lib/format";
import { RecipeCover } from "@/components/recipe-cover";

/**
 * A thin, full-width recipe card for the Plan's Recipes tab. The image side
 * alternates left/right via `flip` to give the list a magazine rhythm.
 */
export function PlanRecipeRow({
  recipe,
  missing,
  flip,
  onRemove,
}: {
  recipe: PlanRecipe;
  missing: number;
  flip: boolean;
  onRemove: () => void;
}) {
  const time = totalTime(recipe.prepTime ?? undefined, recipe.cookTime ?? undefined);
  const meta = [time, recipe.servings ? `serves ${recipe.servings}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border border-ink/10 bg-paper shadow-sm sm:flex-row ${
        flip ? "sm:flex-row-reverse" : ""
      }`}
    >
      <Link
        href={`/recipe/${recipe.slug}`}
        className="h-36 shrink-0 overflow-hidden sm:h-auto sm:w-52"
      >
        <RecipeCover image={recipe.coverImage} title={recipe.title} />
      </Link>

      <div className="flex flex-1 flex-col justify-center gap-2 p-5">
        <div className="flex items-start justify-between gap-3">
          <Link
            href={`/recipe/${recipe.slug}`}
            className="editorial-display text-2xl leading-tight text-ink transition-colors hover:text-terracotta"
          >
            {recipe.title}
          </Link>
          <button
            type="button"
            onClick={onRemove}
            className="kicker shrink-0 text-ink-soft hover:text-clay"
          >
            Remove
          </button>
        </div>
        {meta ? <p className="kicker text-ink-soft">{meta}</p> : null}
        <div>
          {missing === 0 ? (
            <span className="kicker inline-block rounded-full bg-terracotta-wash px-2.5 py-1 text-terracotta">
              Have everything
            </span>
          ) : (
            <span className="kicker inline-block rounded-full border border-ink/20 px-2.5 py-1 text-ink-soft">
              Missing {missing} ingredient{missing === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
