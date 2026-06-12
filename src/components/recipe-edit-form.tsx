"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RecipeEditData, TagOption } from "@/sanity/types";
import { editRecipeText } from "@/app/actions/recipe-actions";

export function RecipeEditForm({
  recipe,
  tags,
}: {
  recipe: RecipeEditData;
  tags: TagOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<string[]>(recipe.steps?.length ? recipe.steps : [""]);
  const [tagIds, setTagIds] = useState<string[]>(recipe.tagIds ?? []);
  const [pending, start] = useTransition();

  const toggleTag = (id: string) =>
    setTagIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const onSubmit = (formData: FormData) => {
    setError(null);
    for (const s of steps) if (s.trim()) formData.append("step", s.trim());
    for (const id of tagIds) formData.append("tag", id);
    start(async () => {
      const res = await editRecipeText(recipe._id, formData);
      if (res.ok) router.push(`/recipe/${res.slug}`);
      else setError(res.error);
    });
  };

  return (
    <form action={onSubmit} className="space-y-6" aria-busy={pending}>
      {error ? <p role="alert" className="text-sm text-terracotta-deep">{error}</p> : null}

      <label className="block">
        <span className="kicker text-ink-soft">Title</span>
        <input name="title" defaultValue={recipe.title} className="mt-1 w-full border-b border-ink/25 bg-transparent pb-1 text-2xl text-ink focus:border-terracotta" />
      </label>
      <label className="block">
        <span className="kicker text-ink-soft">Headnote</span>
        <textarea name="description" defaultValue={recipe.description ?? ""} rows={3} className="mt-1 w-full border border-ink/20 bg-transparent p-2 text-ink focus:border-terracotta" />
      </label>
      <label className="block">
        <span className="kicker text-ink-soft">Story (optional)</span>
        <textarea name="story" defaultValue={recipe.story ?? ""} rows={3} className="mt-1 w-full border border-ink/20 bg-transparent p-2 text-ink focus:border-terracotta" />
      </label>

      <div className="flex gap-4">
        <label className="flex-1"><span className="kicker text-ink-soft">Prep (min)</span>
          <input name="prepTime" type="number" min={0} defaultValue={recipe.prepTime ?? ""} className="mt-1 w-full border-b border-ink/25 bg-transparent pb-1 text-ink" /></label>
        <label className="flex-1"><span className="kicker text-ink-soft">Cook (min)</span>
          <input name="cookTime" type="number" min={0} defaultValue={recipe.cookTime ?? ""} className="mt-1 w-full border-b border-ink/25 bg-transparent pb-1 text-ink" /></label>
        <label className="flex-1"><span className="kicker text-ink-soft">Servings</span>
          <input name="servings" type="number" min={0} defaultValue={recipe.servings ?? ""} className="mt-1 w-full border-b border-ink/25 bg-transparent pb-1 text-ink" /></label>
      </div>

      <section aria-labelledby="steps-heading">
        <h2 id="steps-heading" className="kicker text-terracotta">Steps</h2>
        <ol className="mt-2 space-y-2">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-2">
              <textarea
                value={s}
                onChange={(e) => setSteps((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))}
                aria-label={`Step ${i + 1}`}
                rows={2}
                className="flex-1 border border-ink/20 bg-transparent p-2 text-ink focus:border-terracotta"
              />
              <button type="button" onClick={() => setSteps((xs) => xs.filter((_, j) => j !== i))} aria-label={`Remove step ${i + 1}`} className="kicker text-ink-soft hover:text-terracotta">Remove</button>
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => setSteps((xs) => [...xs, ""])} className="kicker mt-2 text-terracotta hover:text-terracotta-deep">+ Add step</button>
      </section>

      <section aria-labelledby="tags-heading">
        <h2 id="tags-heading" className="kicker text-terracotta">Tags</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.map((t) => {
            const active = tagIds.includes(t._id);
            return (
              <button key={t._id} type="button" aria-pressed={active} onClick={() => toggleTag(t._id)} className={`kicker border px-2 py-1 ${active ? "border-terracotta bg-terracotta-wash text-terracotta" : "border-ink/20 text-ink-soft hover:border-terracotta"}`}>
                {t.name}
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex items-center gap-4 border-t border-terracotta/25 pt-4">
        <button type="submit" disabled={pending} className="kicker rounded-full bg-terracotta px-5 py-2 text-paper hover:bg-terracotta-deep disabled:opacity-40">
          {pending ? "Saving…" : "Save changes"}
        </button>
        <Link href={`/submit?reimport=${recipe._id}`} className="kicker text-ink-soft hover:text-terracotta">
          Re-import ingredients
        </Link>
      </div>
      <p className="text-sm text-ink-soft">
        Editing ingredients re-runs normalization. Use Re-import to change the
        ingredient list, quantities, or macros.
      </p>
    </form>
  );
}
