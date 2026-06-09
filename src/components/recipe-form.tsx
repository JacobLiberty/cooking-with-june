"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveRecipe } from "@/app/actions/recipe-actions";
import { downscaleImage } from "@/lib/image-resize";
import type { IngredientOption, TagOption, RecipeEditData } from "@/sanity/types";

type Row = { name: string; quantity: string; unit: string; optional: boolean };

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
      optional: i.optional ?? false,
    })) ?? [{ name: "", quantity: "", unit: "", optional: false }],
  );
  const [steps, setSteps] = useState<string[]>(initial?.steps ?? [""]);

  function onSubmit(formData: FormData) {
    setError(null);
    start(async () => {
      try {
        // Shrink large photos client-side so they fit Vercel's upload limit.
        const img = formData.get("image");
        if (img instanceof File && img.size > 0) {
          formData.set("image", await downscaleImage(img));
        }
        const res = await saveRecipe(recipeId, formData);
        if (res.ok) router.push(`/recipe/${res.slug}`);
        else setError(res.error);
      } catch {
        setError(
          "Couldn't save — the cover photo may be too large, or the server hit a problem. Please try again.",
        );
      }
    });
  }

  const labelCls = "kicker text-ink-soft";
  const inputCls =
    "mt-1 w-full border-b border-ink/25 bg-transparent pb-1 text-ink focus:border-terracotta";

  return (
    <form action={onSubmit} className="space-y-8">
      {error ? <p className="text-terracotta-deep">{error}</p> : null}

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
        <input
          type="file"
          name="image"
          accept="image/*"
          className="mt-2 block w-full text-sm text-ink-soft file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-terracotta-wash file:px-4 file:py-1.5 file:font-medium file:text-terracotta hover:file:bg-terracotta hover:file:text-paper"
        />
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
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input name="ingQty" defaultValue={row.quantity} placeholder="1" aria-label={`Quantity, ingredient ${i + 1}`} className="w-16 border-b border-ink/25 bg-transparent pb-1 text-ink focus:border-terracotta" />
              <input name="ingUnit" defaultValue={row.unit} placeholder="cup" aria-label={`Unit, ingredient ${i + 1}`} className="w-20 border-b border-ink/25 bg-transparent pb-1 text-ink focus:border-terracotta" />
              <input name="ingName" defaultValue={row.name} list="ingredient-options" placeholder="ingredient" aria-label={`Ingredient ${i + 1} name`} className="min-w-32 flex-1 border-b border-ink/25 bg-transparent pb-1 text-ink focus:border-terracotta" />
              {/* Hidden field keeps one aligned value per row (unchecked boxes don't submit). */}
              <input type="hidden" name="ingOptional" value={row.optional ? "true" : "false"} />
              <label className="kicker flex items-center gap-1.5 whitespace-nowrap text-ink-soft">
                <input
                  type="checkbox"
                  checked={row.optional}
                  onChange={(e) =>
                    setRows((rs) =>
                      rs.map((r, j) => (j === i ? { ...r, optional: e.target.checked } : r)),
                    )
                  }
                  className="accent-terracotta"
                />
                optional
              </label>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setRows((r) => [...r, { name: "", quantity: "", unit: "", optional: false }])} className="kicker mt-2 text-terracotta">+ add ingredient</button>
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
          <div className="mt-2 flex flex-wrap gap-2">
            {tags.map((t) => (
              <label key={t._id} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="tag"
                  value={t._id}
                  defaultChecked={initial?.tagIds?.includes(t._id) ?? false}
                  className="peer sr-only"
                />
                <span className="kicker inline-block rounded-full border border-ink/20 px-3 py-1.5 text-ink-soft transition-colors hover:border-terracotta peer-checked:border-terracotta peer-checked:bg-terracotta peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-terracotta">
                  {t.name}
                </span>
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
