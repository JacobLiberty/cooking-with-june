"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TagOption } from "@/sanity/types";
import type { RecipeDraft, DraftLine } from "@/lib/import/types";
import { computeDraftMacros } from "@/lib/import/assemble";
import { importRecipe } from "@/app/actions/import-actions";
import { publishRecipe } from "@/app/actions/publish-actions";
import { CheckBox } from "@/components/check-box";

export function ImportReview({
  tags,
  initialBlurb = "",
  recipeId,
}: {
  tags: TagOption[];
  initialBlurb?: string;
  recipeId?: string;
}) {
  const router = useRouter();
  const [blurb, setBlurb] = useState(initialBlurb);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const macros = useMemo(
    () => (draft ? computeDraftMacros(draft.ingredients, draft.servings) : null),
    [draft],
  );

  const generate = () => {
    setError(null);
    start(async () => {
      const res = await importRecipe(blurb);
      if (res.ok) setDraft(res.draft);
      else setError(res.error);
    });
  };

  const patchLine = (i: number, next: Partial<DraftLine>) =>
    setDraft((d) =>
      d ? { ...d, ingredients: d.ingredients.map((l, j) => (j === i ? { ...l, ...next } : l)) } : d,
    );

  const removeLine = (i: number) =>
    setDraft((d) =>
      d ? { ...d, ingredients: d.ingredients.filter((_, j) => j !== i) } : d,
    );

  const publish = () => {
    if (!draft) return;
    setError(null);
    start(async () => {
      const res = await publishRecipe(draft, recipeId ? { recipeId } : undefined);
      if (res.ok) router.push(`/recipe/${res.slug}`);
      else setError(res.error);
    });
  };

  if (!draft) {
    return (
      <div className="mt-8 space-y-3" aria-busy={pending}>
        <label className="kicker block text-ink-soft" htmlFor="blurb">Recipe text</label>
        <textarea
          id="blurb"
          value={blurb}
          onChange={(e) => setBlurb(e.target.value)}
          rows={12}
          placeholder="Paste the recipe here…"
          className="w-full border border-ink/20 bg-transparent p-3 text-ink focus:border-terracotta"
        />
        {error ? <p role="alert" className="text-sm text-terracotta-deep">{error}</p> : null}
        <button
          type="button"
          onClick={generate}
          disabled={pending || !blurb.trim()}
          className="kicker rounded-full bg-terracotta px-5 py-2 text-paper hover:bg-terracotta-deep disabled:opacity-40"
        >
          {pending ? "Reading…" : "Generate draft"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6" aria-busy={pending}>
      {error ? <p role="alert" className="text-sm text-terracotta-deep">{error}</p> : null}

      <label className="block">
        <span className="kicker text-ink-soft">Title</span>
        <input
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          className="mt-1 w-full border-b border-ink/25 bg-transparent pb-1 text-2xl text-ink focus:border-terracotta"
        />
      </label>

      <label className="block">
        <span className="kicker text-ink-soft">Headnote</span>
        <textarea
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          rows={3}
          className="mt-1 w-full border border-ink/20 bg-transparent p-2 text-ink focus:border-terracotta"
        />
      </label>

      <div className="flex gap-4">
        {(["prepTime", "cookTime", "servings"] as const).map((k) => (
          <label key={k} className="flex-1">
            <span className="kicker text-ink-soft">{k === "prepTime" ? "Prep (min)" : k === "cookTime" ? "Cook (min)" : "Servings"}</span>
            <input
              type="number"
              min={0}
              value={draft[k] ?? ""}
              onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) || undefined })}
              className="mt-1 w-full border-b border-ink/25 bg-transparent pb-1 text-ink focus:border-terracotta"
            />
          </label>
        ))}
      </div>

      <section aria-labelledby="ing-heading">
        <h2 id="ing-heading" className="kicker text-terracotta">Ingredients</h2>
        <ul className="mt-2 space-y-2">
          {draft.ingredients.map((line, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <input
                value={line.quantity ?? ""}
                onChange={(e) => patchLine(i, { quantity: e.target.value })}
                aria-label={`Quantity for ${line.name}`}
                className="w-16 border-b border-ink/25 bg-transparent pb-1 text-ink"
              />
              <input
                value={line.unit ?? ""}
                onChange={(e) => patchLine(i, { unit: e.target.value })}
                aria-label={`Unit for ${line.name}`}
                className="w-16 border-b border-ink/25 bg-transparent pb-1 text-ink"
              />
              <input
                value={line.name}
                onChange={(e) => patchLine(i, { name: e.target.value })}
                aria-label={`Name for ingredient ${i + 1}`}
                className="min-w-32 flex-1 border-b border-ink/25 bg-transparent pb-1 text-ink"
              />
              {line.isNew ? <span className="kicker rounded-full bg-clay-wash px-2 py-0.5 text-ink-soft">new</span> : null}
              <CheckBox
                checked={line.optional}
                onChange={() => patchLine(i, { optional: !line.optional })}
                label={`${line.name} optional`}
              />
              <button
                type="button"
                onClick={() => removeLine(i)}
                aria-label={`Remove ${line.name || `ingredient ${i + 1}`}`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-terracotta-wash hover:text-terracotta"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {macros ? (
        <p className="text-sm text-ink-soft" aria-live="polite">
          Macros / serving — base {macros.base.calories} kcal · full {macros.full.calories} kcal
          {macros.unparsedLines.length ? ` (skipped: ${macros.unparsedLines.join(", ")})` : ""}
        </p>
      ) : null}

      <section aria-labelledby="tag-heading">
        <h2 id="tag-heading" className="kicker text-terracotta">Tags</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.map((t) => {
            const active = draft.candidateTags.includes(t.name);
            return (
              <button
                key={t._id}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setDraft({
                    ...draft,
                    candidateTags: active
                      ? draft.candidateTags.filter((n) => n !== t.name)
                      : [...draft.candidateTags, t.name],
                  })
                }
                className={`kicker border px-2 py-1 ${active ? "border-terracotta bg-terracotta-wash text-terracotta" : "border-ink/20 text-ink-soft hover:border-terracotta"}`}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex items-center gap-4 border-t border-terracotta/25 pt-4">
        <button
          type="button"
          onClick={publish}
          disabled={pending || !draft.title.trim()}
          className="kicker rounded-full bg-terracotta px-5 py-2 text-paper hover:bg-terracotta-deep disabled:opacity-40"
        >
          {pending ? "Publishing…" : "Publish recipe"}
        </button>
        <button
          type="button"
          onClick={() => setDraft(null)}
          className="kicker text-ink-soft hover:text-terracotta"
        >
          Start over
        </button>
      </div>
    </div>
  );
}
