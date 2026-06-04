"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveRecipe } from "@/app/actions/recipe-actions";
import type { IngredientOption, TagOption, RecipeEditData } from "@/sanity/types";

type Row = { name: string; quantity: string; unit: string };

export function RecipeForm({
  recipeId = null,
  initial,
  ingredients,
  tags,
}: {
  recipeId?: string | null;
  initial?: RecipeEditData | null;
  ingredients: IngredientOption[];
  tags: TagOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>(
    initial?.ingredients?.map((i) => ({
      name: i.name ?? "",
      quantity: i.quantity ?? "",
      unit: i.unit ?? "",
    })) ?? [{ name: "", quantity: "", unit: "" }],
  );
  const [steps, setSteps] = useState<string[]>(initial?.steps ?? [""]);

  function onSubmit(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await saveRecipe(recipeId, formData);
      if (res.ok) router.push(`/recipe/${res.slug}`);
      else setError(res.error);
    });
  }

  const labelCls = "kicker text-ink-soft";
  const inputCls =
    "mt-1 w-full border-b border-ink/25 bg-transparent pb-1 text-ink focus:border-terracotta";

  return (
    <form action={onSubmit} className="space-y-8">
      {error ? <p className="text-clay">{error}</p> : null}

      <label className="block">
        <span className={labelCls}>Title</span>
        <input name="title" defaultValue={initial?.title ?? ""} required className={inputCls} />
      </label>

      <label className="block">
        <span className={labelCls}>Description</span>
        <textarea name="description" defaultValue={initial?.description ?? ""} rows={2} className={inputCls} />
      </label>

      <label className="block">
        <span className={labelCls}>Story (optional)</span>
        <textarea name="story" defaultValue={initial?.story ?? ""} rows={3} className={inputCls} />
      </label>

      <label className="block">
        <span className={labelCls}>Cover photo {initial?.hasImage ? "(leave empty to keep current)" : ""}</span>
        <input type="file" name="image" accept="image/*" className="mt-1 block text-ink-soft" />
      </label>

      <div className="grid grid-cols-3 gap-4">
        <label className="block"><span className={labelCls}>Prep (min)</span>
          <input type="number" name="prepTime" min={0} defaultValue={initial?.prepTime ?? ""} className={inputCls} /></label>
        <label className="block"><span className={labelCls}>Cook (min)</span>
          <input type="number" name="cookTime" min={0} defaultValue={initial?.cookTime ?? ""} className={inputCls} /></label>
        <label className="block"><span className={labelCls}>Servings</span>
          <input type="number" name="servings" min={1} defaultValue={initial?.servings ?? ""} className={inputCls} /></label>
      </div>

      <fieldset>
        <legend className={labelCls}>Ingredients</legend>
        <datalist id="ingredient-options">
          {ingredients.map((i) => <option key={i._id} value={i.name} />)}
        </datalist>
        <div className="mt-2 space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input name="ingQty" defaultValue={row.quantity} placeholder="1" className="w-16 border-b border-ink/25 bg-transparent pb-1 text-ink focus:border-terracotta" />
              <input name="ingUnit" defaultValue={row.unit} placeholder="cup" className="w-20 border-b border-ink/25 bg-transparent pb-1 text-ink focus:border-terracotta" />
              <input name="ingName" defaultValue={row.name} list="ingredient-options" placeholder="ingredient" className="flex-1 border-b border-ink/25 bg-transparent pb-1 text-ink focus:border-terracotta" />
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setRows((r) => [...r, { name: "", quantity: "", unit: "" }])} className="kicker mt-2 text-terracotta">+ add ingredient</button>
      </fieldset>

      <fieldset>
        <legend className={labelCls}>Steps</legend>
        <div className="mt-2 space-y-2">
          {steps.map((s, i) => (
            <textarea key={i} name="step" defaultValue={s} rows={2} placeholder={`Step ${i + 1}`} className="w-full border border-ink/15 bg-paper p-2 text-ink focus:border-terracotta" />
          ))}
        </div>
        <button type="button" onClick={() => setSteps((s) => [...s, ""])} className="kicker mt-2 text-terracotta">+ add step</button>
      </fieldset>

      {tags.length > 0 && (
        <fieldset>
          <legend className={labelCls}>Tags</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {tags.map((t) => (
              <label key={t._id} className="flex items-center gap-1 text-ink-soft">
                <input type="checkbox" name="tag" value={t._id} defaultChecked={initial?.tagIds?.includes(t._id) ?? false} />
                <span className="kicker">{t.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <button type="submit" disabled={pending} className="kicker border border-terracotta bg-terracotta-wash px-4 py-2 text-terracotta hover:bg-terracotta hover:text-paper disabled:opacity-50">
        {pending ? "Saving…" : recipeId ? "Save changes" : "Create recipe"}
      </button>
    </form>
  );
}
