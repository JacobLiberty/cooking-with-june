"use client";

import { useMemo, useState, useTransition } from "react";
import { AnimatePresence, m } from "motion/react";
import type {
  PlanRecipe,
  ManualItem,
  ManualLocation,
  RecipeScale,
} from "@/sanity/plan-types";
import type { IngredientOption } from "@/sanity/types";
import { missingFromPantry, groceryAfterRecipeRemoval } from "@/lib/pantry";
import { groceryMetaByIngredient } from "@/lib/grocery";
import { scaleQuantity } from "@/lib/scale";
import { CheckBox } from "@/components/check-box";
import { PlanRecipeRow } from "@/components/plan-recipe-row";
import { useToast } from "@/components/toast";
import {
  addToPlan,
  removeFromPlan,
  checkGroceryIngredient,
  skipGroceryIngredient,
  removePantryIngredient,
  movePantryIngredientToGrocery,
  addManualItem,
  setManualLocation,
  removeManualItem,
  syncGroceryFromRecipes,
} from "@/app/actions/plan-actions";

type Tab = "recipes" | "groceries";
type Row =
  | { kind: "auto"; id: string; name: string }
  | { kind: "manual"; key: string; name: string };

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name);

export function PlanView({
  recipes: initialRecipes,
  manual: initialManual,
  groceryIds: initialGrocery,
  pantryIds: initialPantry,
  ingredients,
  recipeScales,
}: {
  recipes: PlanRecipe[];
  manual: ManualItem[];
  groceryIds: string[];
  pantryIds: string[];
  ingredients: IngredientOption[];
  recipeScales: RecipeScale[];
}) {
  const [tab, setTab] = useState<Tab>("recipes");
  const [recipes, setRecipes] = useState(initialRecipes);
  const [grocery, setGrocery] = useState<Set<string>>(() => new Set(initialGrocery));
  const [pantry, setPantry] = useState<Set<string>>(() => new Set(initialPantry));
  const [manual, setManual] = useState<ManualItem[]>(initialManual);
  const [newItem, setNewItem] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  // id → display name, from the ingredient list plus any names carried on the
  // planned recipes (covers pantry items whose recipe is no longer planned).
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const ing of ingredients) map.set(ing._id, ing.name);
    for (const r of recipes)
      for (const line of r.ingredients ?? [])
        if (line.ingredientId) map.set(line.ingredientId, line.name ?? line.ingredientId);
    return map;
  }, [ingredients, recipes]);

  const nameOf = (id: string) => nameById.get(id) ?? id;

  // Scaled grocery amounts: for each ingredient id, the distinct quantities its
  // planned recipes contribute (quantity × that recipe's serving scale).
  const amountById = useMemo(() => {
    const scaleOf = new Map(
      recipeScales.map((s) => [s.recipeId, s.scale ?? 1] as const),
    );
    const map = new Map<string, string[]>();
    for (const r of recipes) {
      const factor = scaleOf.get(r._id) ?? 1;
      for (const line of r.ingredients ?? []) {
        if (!line.ingredientId) continue;
        const amount = [scaleQuantity(line.quantity, factor), line.unit]
          .filter(Boolean)
          .join(" ")
          .trim();
        if (!amount) continue;
        const list = map.get(line.ingredientId) ?? [];
        if (!list.includes(amount)) list.push(amount);
        map.set(line.ingredientId, list);
      }
    }
    return map;
  }, [recipes, recipeScales]);

  const amountOf = (id: string) => amountById.get(id)?.join(" · ") ?? "";

  // Per-ingredient: how many planned recipes use it, and whether it reads as
  // optional (only when a single recipe uses it and marks it optional).
  const groceryMeta = useMemo(
    () => groceryMetaByIngredient(recipes ?? []),
    [recipes],
  );

  const act = (action: () => Promise<unknown>, revert: () => void) => {
    setError(null);
    start(async () => {
      try {
        await action();
      } catch {
        revert();
        setError("Couldn't save that — please try again.");
      }
    });
  };

  // ── rows ────────────────────────────────────────────────────────────────
  const groceryRows: Row[] = [
    ...[...grocery].map((id) => ({ kind: "auto" as const, id, name: nameOf(id) })),
    ...manual
      .filter((m) => m.location !== "pantry")
      .map((m) => ({ kind: "manual" as const, key: m._key, name: m.name })),
  ].sort(byName);

  const pantryRows: Row[] = [
    ...[...pantry].map((id) => ({ kind: "auto" as const, id, name: nameOf(id) })),
    ...manual
      .filter((m) => m.location === "pantry")
      .map((m) => ({ kind: "manual" as const, key: m._key, name: m.name })),
  ].sort(byName);

  // ── recipe handlers ───────────────────────────────────────────────────────
  const removeRecipe = (recipe: PlanRecipe) => {
    const prevRecipes = recipes;
    const prevGrocery = grocery;
    const removedIds = (recipe.ingredients ?? [])
      .map((l) => l.ingredientId)
      .filter((x): x is string => Boolean(x));
    const remaining = recipes
      .filter((r) => r._id !== recipe._id)
      .flatMap((r) => (r.ingredients ?? []).map((l) => l.ingredientId))
      .filter((x): x is string => Boolean(x));
    setRecipes((rs) => rs.filter((r) => r._id !== recipe._id));
    setGrocery(
      () => new Set(groceryAfterRecipeRemoval([...grocery], removedIds, remaining)),
    );
    act(
      () => removeFromPlan(recipe._id),
      () => {
        setRecipes(prevRecipes);
        setGrocery(prevGrocery);
      },
    );
    toast({
      message: `Removed ${recipe.title}`,
      actionLabel: "Undo",
      onAction: () => {
        setRecipes(prevRecipes);
        setGrocery(prevGrocery);
        act(
          () => addToPlan(recipe._id),
          () => setRecipes((rs) => rs.filter((r) => r._id !== recipe._id)),
        );
      },
    });
  };

  // ── grocery / pantry handlers (optimistic Set/array updates) ───────────────
  const moveAuto = (
    id: string,
    from: "grocery" | "pantry" | null,
    to: "grocery" | "pantry" | null,
    action: () => Promise<unknown>,
  ) => {
    const prevG = grocery;
    const prevP = pantry;
    const nextG = new Set(grocery);
    const nextP = new Set(pantry);
    if (from === "grocery") nextG.delete(id);
    if (from === "pantry") nextP.delete(id);
    if (to === "grocery") nextG.add(id);
    if (to === "pantry") nextP.add(id);
    setGrocery(nextG);
    setPantry(nextP);
    act(action, () => {
      setGrocery(prevG);
      setPantry(prevP);
    });
  };

  const setManualLoc = (key: string, location: ManualLocation) => {
    const prev = manual;
    setManual((m) => m.map((x) => (x._key === key ? { ...x, location } : x)));
    act(() => setManualLocation(key, location), () => setManual(prev));
  };

  const dropManual = (key: string) => {
    const prev = manual;
    setManual((m) => m.filter((x) => x._key !== key));
    act(() => removeManualItem(key), () => setManual(prev));
  };

  // Seed the grocery list from every planned recipe (ingredients not already
  // on the list or in the pantry). Doubles as a refresh after planning more.
  const syncGrocery = () => {
    const prev = grocery;
    const next = new Set(grocery);
    for (const r of recipes)
      for (const line of r.ingredients ?? [])
        if (line.ingredientId && !pantry.has(line.ingredientId))
          next.add(line.ingredientId);
    setGrocery(next);
    act(() => syncGroceryFromRecipes(), () => setGrocery(prev));
  };

  const addItem = () => {
    const name = newItem.trim();
    if (!name) return;
    const key = crypto.randomUUID();
    setManual((m) => [...m, { _key: key, name, location: "grocery" }]);
    setNewItem("");
    act(
      async () => {
        const res = await addManualItem(name, key);
        if (res && !res.ok) throw new Error(res.error);
      },
      () => setManual((m) => m.filter((x) => x._key !== key)),
    );
  };

  // check (grocery → pantry) / skip (remove from grocery)
  const onCheck = (row: Row) =>
    row.kind === "auto"
      ? moveAuto(row.id, "grocery", "pantry", () => checkGroceryIngredient(row.id))
      : setManualLoc(row.key, "pantry");
  const onSkip = (row: Row) =>
    row.kind === "auto"
      ? moveAuto(row.id, "grocery", null, () => skipGroceryIngredient(row.id))
      : dropManual(row.key);
  // pantry: back to grocery / remove
  const onRestock = (row: Row) =>
    row.kind === "auto"
      ? moveAuto(row.id, "pantry", "grocery", () => movePantryIngredientToGrocery(row.id))
      : setManualLoc(row.key, "grocery");
  const onUse = (row: Row) =>
    row.kind === "auto"
      ? moveAuto(row.id, "pantry", null, () => removePantryIngredient(row.id))
      : dropManual(row.key);

  const rowKey = (row: Row) => (row.kind === "auto" ? `a-${row.id}` : `m-${row.key}`);

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div aria-busy={pending}>
      <div className="flex gap-2" role="tablist" aria-label="Plan sections">
        {(["recipes", "groceries"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`kicker rounded-full px-4 py-2 transition-colors ${
              tab === t
                ? "bg-terracotta text-paper"
                : "text-ink-soft hover:text-terracotta"
            }`}
          >
            {t === "recipes" ? "Recipes" : "Groceries"}
          </button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-terracotta-deep">
          {error}
        </p>
      ) : null}

      {tab === "recipes" ? (
        <div className="mt-6 space-y-4">
          {recipes.length === 0 ? (
            <p className="text-ink-soft">
              Nothing planned yet — add recipes from their pages.
            </p>
          ) : (
            recipes.map((r, i) => (
              <PlanRecipeRow
                key={r._id}
                recipe={r}
                missing={missingFromPantry(
                  (r.ingredients ?? [])
                    .map((l) => l.ingredientId)
                    .filter((x): x is string => Boolean(x)),
                  pantry,
                )}
                flip={i % 2 === 1}
                onRemove={() => removeRecipe(r)}
              />
            ))
          )}
        </div>
      ) : (
        <div className="mt-6 grid gap-8 sm:grid-cols-2">
          <section aria-labelledby="grocery-heading">
            <div className="flex items-center justify-between gap-3">
              <h2 id="grocery-heading" className="kicker text-terracotta">
                Grocery list
              </h2>
              {recipes.length > 0 ? (
                <button
                  type="button"
                  onClick={syncGrocery}
                  className="kicker text-ink-soft hover:text-terracotta"
                >
                  Pull from recipes
                </button>
              ) : null}
            </div>
            <ul className="mt-3 space-y-2">
              <AnimatePresence initial={false}>
                {groceryRows.map((row) => (
                  <m.li
                    key={rowKey(row)}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-center gap-3"
                  >
                    <CheckBox
                      checked={false}
                      onChange={() => onCheck(row)}
                      label={`Got ${row.name}`}
                    />
                    <span className="flex flex-1 flex-wrap items-center gap-x-2 text-ink">
                      <span>
                        {row.name}
                        {row.kind === "auto" && amountOf(row.id) ? (
                          <span className="text-ink-soft"> · {amountOf(row.id)}</span>
                        ) : null}
                      </span>
                      {row.kind === "auto" &&
                      (groceryMeta.get(row.id)?.recipeCount ?? 0) >= 2 ? (
                        <span
                          className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-clay-wash px-1.5 text-xs text-ink"
                          title={`Used in ${groceryMeta.get(row.id)?.recipeCount} recipes`}
                          aria-label={`Used in ${groceryMeta.get(row.id)?.recipeCount} recipes`}
                        >
                          {groceryMeta.get(row.id)?.recipeCount}
                        </span>
                      ) : null}
                      {row.kind === "auto" && groceryMeta.get(row.id)?.isOptional ? (
                        <span className="kicker rounded-full bg-ink/5 px-2 py-0.5 text-ink-soft">
                          optional
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSkip(row)}
                      aria-label={`Skip ${row.name}`}
                      className="kicker text-ink-soft hover:text-terracotta"
                    >
                      Skip
                    </button>
                  </m.li>
                ))}
              </AnimatePresence>
              {groceryRows.length === 0 ? (
                <li className="text-ink-soft">Your grocery list is empty.</li>
              ) : null}
            </ul>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                addItem();
              }}
              className="mt-4 flex items-center gap-3"
            >
              <input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                maxLength={120}
                aria-label="Add a grocery item"
                placeholder="Add an item…"
                className="flex-1 border-b border-ink/25 bg-transparent pb-1 text-ink placeholder:text-ink-soft focus:border-terracotta"
              />
              <button
                type="submit"
                className="kicker text-terracotta hover:text-terracotta-deep"
              >
                Add
              </button>
            </form>
          </section>

          <section aria-labelledby="pantry-heading">
            <h2 id="pantry-heading" className="kicker text-terracotta">
              Pantry
            </h2>
            <ul className="mt-3 space-y-2">
              <AnimatePresence initial={false}>
                {pantryRows.map((row) => (
                  <m.li
                    key={rowKey(row)}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-center gap-3"
                  >
                    <span className="flex-1 text-ink">{row.name}</span>
                    <button
                      type="button"
                      onClick={() => onRestock(row)}
                      aria-label={`Add ${row.name} back to the grocery list`}
                      className="kicker text-ink-soft hover:text-terracotta"
                    >
                      Need again
                    </button>
                    <button
                      type="button"
                      onClick={() => onUse(row)}
                      aria-label={`Remove ${row.name} from the pantry`}
                      className="kicker text-ink-soft hover:text-terracotta"
                    >
                      Used up
                    </button>
                  </m.li>
                ))}
              </AnimatePresence>
              {pantryRows.length === 0 ? (
                <li className="text-ink-soft">
                  Check items off the grocery list and they&rsquo;ll land here.
                </li>
              ) : null}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
