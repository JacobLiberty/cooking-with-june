"use client";

import { useState } from "react";
import Link from "next/link";
import { ShareButton } from "@/components/share-button";
import { DeleteRecipeButton } from "@/components/delete-recipe-button";

/**
 * Member-only overflow for the quieter recipe actions. Cook mode and the plan
 * toggle stay visible; Edit / Share / Delete live behind a ⋯ toggle so the
 * header reads as one clear hierarchy.
 */
export function RecipeActionsMenu({
  slug,
  recipeId,
  title,
}: {
  slug: string;
  recipeId: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span className="inline-flex flex-wrap items-center gap-x-5 gap-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="More actions"
        className="kicker text-ink-soft transition-colors hover:text-terracotta"
      >
        ⋯
      </button>
      {open ? (
        <>
          <Link
            href={`/recipe/${slug}/edit`}
            className="kicker text-terracotta hover:text-terracotta-deep"
          >
            Edit
          </Link>
          <ShareButton />
          <DeleteRecipeButton recipeId={recipeId} title={title} />
        </>
      ) : null}
    </span>
  );
}
