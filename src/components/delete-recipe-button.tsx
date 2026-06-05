"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteRecipe } from "@/app/actions/recipe-actions";

/**
 * Editor-only recipe delete. Two-step inline confirm (no modal): the first tap
 * reveals a confirm/cancel pair so a stray tap can't wipe a recipe. On success
 * it returns to the collection.
 */
export function DeleteRecipeButton({
  recipeId,
  title,
}: {
  recipeId: string;
  title: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
        className="kicker text-ink-soft transition-colors hover:text-terracotta-deep"
      >
        Delete
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <span className="kicker text-terracotta-deep">Delete this recipe?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await deleteRecipe(recipeId);
            if (res.ok) {
              router.push("/");
            } else {
              // Keep the confirm open so the error is visible and retryable.
              setError(res.error ?? "Couldn't delete the recipe");
            }
          })
        }
        className="kicker rounded-full bg-terracotta px-3 py-1 text-paper transition-colors hover:bg-terracotta-deep disabled:opacity-50"
      >
        {pending ? "Deleting…" : `Delete ${title}`}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirming(false)}
        className="kicker text-ink-soft transition-colors hover:text-terracotta"
      >
        Cancel
      </button>
      {error ? (
        <span className="kicker text-terracotta-deep">{error}</span>
      ) : null}
    </span>
  );
}
