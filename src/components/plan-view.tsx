"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { buildGroceryList } from "@/lib/grocery";
import type { PlanRecipe, ManualItem } from "@/sanity/plan-types";
import { CheckBox } from "@/components/check-box";
import {
  removeFromPlan,
  toggleIngredientGot,
  skipIngredient,
  unskipIngredient,
  addManualItem,
  toggleManualItem,
  deleteManualItem,
  setAllGot,
} from "@/app/actions/plan-actions";

export function PlanView({
  recipes: initialRecipes,
  checkedIds,
  removedIds,
  manual: initialManual,
}: {
  recipes: PlanRecipe[];
  checkedIds: string[];
  removedIds: string[];
  manual: ManualItem[];
}) {
  const [recipes, setRecipes] = useState(initialRecipes);
  const [checked, setChecked] = useState<Set<string>>(() => new Set(checkedIds));
  const [removed, setRemoved] = useState<Set<string>>(() => new Set(removedIds));
  const [manual, setManual] = useState<ManualItem[]>(initialManual);
  const [newItem, setNewItem] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const grocery = useMemo(
    () => buildGroceryList(recipes.map((r) => r.ingredients ?? [])),
    [recipes],
  );

  // Optimistic: apply locally now, run the action in the background, roll back
  // the one change if it fails. No await/refresh on the UI path → no freeze.
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

  const autoToGet = grocery.filter(
    (g) => !checked.has(g.ingredientId) && !removed.has(g.ingredientId),
  );
  const autoGot = grocery.filter((g) => checked.has(g.ingredientId));
  const autoSkipped = grocery.filter(
    (g) => removed.has(g.ingredientId) && !checked.has(g.ingredientId),
  );
  const manualToGet = manual.filter((m) => !m.gotIt);
  const manualGot = manual.filter((m) => m.gotIt);
  const remainingCount = autoToGet.length + manualToGet.length;

  // ── handlers ──────────────────────────────────────────────────────────
  const toggleAuto = (id: string) => {
    const was = checked.has(id);
    setChecked((s) => {
      const n = new Set(s);
      if (was) n.delete(id);
      else n.add(id);
      return n;
    });
    act(
      () => toggleIngredientGot(id),
      () =>
        setChecked((s) => {
          const n = new Set(s);
          if (was) n.add(id);
          else n.delete(id);
          return n;
        }),
    );
  };

  const skipAuto = (id: string) => {
    setRemoved((s) => new Set(s).add(id));
    act(
      () => skipIngredient(id),
      () =>
        setRemoved((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        }),
    );
  };

  const restoreAuto = (id: string) => {
    setRemoved((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    act(() => unskipIngredient(id), () => setRemoved((s) => new Set(s).add(id)));
  };

  const flipManual = (key: string) => {
    setManual((m) =>
      m.map((x) => (x._key === key ? { ...x, gotIt: !x.gotIt } : x)),
    );
    act(
      () => toggleManualItem(key),
      () =>
        setManual((m) =>
          m.map((x) => (x._key === key ? { ...x, gotIt: !x.gotIt } : x)),
        ),
    );
  };

  const removeManual = (key: string) => {
    const snapshot = manual;
    setManual((m) => m.filter((x) => x._key !== key));
    act(() => deleteManualItem(key), () => setManual(snapshot));
  };

  const addItem = () => {
    const name = newItem.trim();
    if (!name) return;
    const key = crypto.randomUUID();
    setManual((m) => [...m, { _key: key, name, gotIt: false }]);
    setNewItem("");
    act(
      async () => {
        const res = await addManualItem(name, key);
        if (res && !res.ok) throw new Error(res.error);
      },
      () => setManual((m) => m.filter((x) => x._key !== key)),
    );
  };

  const removeRecipe = (id: string) => {
    const snapshot = recipes;
    setRecipes((r) => r.filter((x) => x._id !== id));
    act(() => removeFromPlan(id), () => setRecipes(snapshot));
  };

  const markAllGot = () => {
    const prevChecked = checked;
    const prevManual = manual;
    const ids = autoToGet.map((g) => g.ingredientId);
    setChecked((s) => new Set([...s, ...ids]));
    setManual((m) => m.map((x) => ({ ...x, gotIt: true })));
    act(
      () => setAllGot(true),
      () => {
        setChecked(prevChecked);
        setManual(prevManual);
      },
    );
  };

  // ── render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-10" aria-busy={pending}>
      {error ? (
        <p role="alert" className="text-sm text-clay">
          {error}
        </p>
      ) : null}

      <section aria-labelledby="planned-heading">
        <h2 id="planned-heading" className="kicker text-terracotta">
          Planned recipes
        </h2>
        {recipes.length === 0 ? (
          <p className="mt-2 text-ink-soft">
            Nothing planned yet — add recipes from their pages.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {recipes.map((r) => (
              <li key={r._id} className="flex items-center justify-between gap-3">
                <Link
                  href={`/recipe/${r.slug}`}
                  className="text-ink hover:text-terracotta"
                >
                  {r.title}
                </Link>
                <button
                  type="button"
                  onClick={() => removeRecipe(r._id)}
                  className="kicker text-ink-soft hover:text-clay"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="grocery-heading">
        <div className="flex items-center justify-between">
          <h2 id="grocery-heading" className="kicker text-terracotta">
            Grocery list
          </h2>
          {remainingCount > 0 ? (
            <button
              type="button"
              onClick={markAllGot}
              className="kicker text-ink-soft hover:text-terracotta"
            >
              Mark all got
            </button>
          ) : null}
        </div>

        <ul className="mt-3 space-y-2">
          {autoToGet.map((g) => (
            <li key={g.ingredientId} className="flex items-center gap-3">
              <CheckBox
                checked={false}
                onChange={() => toggleAuto(g.ingredientId)}
                label={`Got ${g.name}`}
              />
              <span className="flex-1 text-ink">
                {g.name}
                {g.amounts.length ? (
                  <span className="text-ink-soft"> ({g.amounts.join(" · ")})</span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => skipAuto(g.ingredientId)}
                aria-label={`Skip ${g.name}`}
                className="kicker text-ink-soft hover:text-clay"
              >
                Skip
              </button>
            </li>
          ))}
          {manualToGet.map((m) => (
            <li key={m._key} className="flex items-center gap-3">
              <CheckBox
                checked={false}
                onChange={() => flipManual(m._key)}
                label={`Got ${m.name}`}
              />
              <span className="flex-1 text-ink">{m.name}</span>
              <button
                type="button"
                onClick={() => removeManual(m._key)}
                aria-label={`Delete ${m.name}`}
                className="kicker text-ink-soft hover:text-clay"
              >
                Delete
              </button>
            </li>
          ))}
          {remainingCount === 0 && grocery.length + manual.length > 0 ? (
            <li className="text-ink-soft">All set &mdash; everything&rsquo;s checked off.</li>
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
            placeholder="Add an item (e.g. milk for coffee)…"
            className="flex-1 border-b border-ink/25 bg-transparent pb-1 text-ink placeholder:text-ink-soft/60 focus:border-terracotta"
          />
          <button
            type="submit"
            className="kicker text-terracotta hover:text-terracotta-deep"
          >
            Add
          </button>
        </form>

        {autoGot.length + manualGot.length > 0 ? (
          <div className="mt-6">
            <p className="kicker text-ink-soft">Got it</p>
            <ul className="mt-2 space-y-2">
              {autoGot.map((g) => (
                <li key={g.ingredientId} className="flex items-center gap-3 text-ink-soft">
                  <CheckBox
                    checked
                    onChange={() => toggleAuto(g.ingredientId)}
                    label={`Un-check ${g.name}`}
                  />
                  <span className="line-through">{g.name}</span>
                </li>
              ))}
              {manualGot.map((m) => (
                <li key={m._key} className="flex items-center gap-3 text-ink-soft">
                  <CheckBox
                    checked
                    onChange={() => flipManual(m._key)}
                    label={`Un-check ${m.name}`}
                  />
                  <span className="flex-1 line-through">{m.name}</span>
                  <button
                    type="button"
                    onClick={() => removeManual(m._key)}
                    aria-label={`Delete ${m.name}`}
                    className="kicker hover:text-clay"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {autoSkipped.length > 0 ? (
          <div className="mt-6">
            <p className="kicker text-ink-soft">Not getting</p>
            <ul className="mt-2 space-y-2">
              {autoSkipped.map((g) => (
                <li key={g.ingredientId} className="flex items-center gap-3 text-ink-soft">
                  <span className="flex-1 line-through">{g.name}</span>
                  <button
                    type="button"
                    onClick={() => restoreAuto(g.ingredientId)}
                    className="kicker hover:text-terracotta"
                  >
                    Add back
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
