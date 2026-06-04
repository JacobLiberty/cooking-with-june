"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { GroceryItem } from "@/lib/grocery";
import type { PlanRecipe, ManualItem } from "@/sanity/plan-types";
import {
  removeFromPlan,
  toggleIngredientGot,
  addManualItem,
  toggleManualItem,
  deleteManualItem,
  setAllGot,
} from "@/app/actions/plan-actions";

export function PlanView({
  recipes,
  toGet,
  got,
  manual,
}: {
  recipes: PlanRecipe[];
  toGet: GroceryItem[];
  got: GroceryItem[];
  manual: ManualItem[];
}) {
  const [pending, start] = useTransition();
  const [newItem, setNewItem] = useState("");
  const router = useRouter();
  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  const manualToGet = manual.filter((m) => !m.gotIt);
  const manualGot = manual.filter((m) => m.gotIt);

  return (
    <div className="space-y-10" aria-busy={pending}>
      {/* planned recipes */}
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
                <Link href={`/recipe/${r.slug}`} className="text-ink hover:text-terracotta">
                  {r.title}
                </Link>
                <button
                  type="button"
                  onClick={() => run(() => removeFromPlan(r._id))}
                  className="kicker text-ink-soft hover:text-clay"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* grocery list */}
      <section aria-labelledby="grocery-heading">
        <div className="flex items-center justify-between">
          <h2 id="grocery-heading" className="kicker text-terracotta">
            Grocery list
          </h2>
          {toGet.length + manualToGet.length + got.length + manualGot.length > 0 ? (
            <button
              type="button"
              onClick={() => run(() => setAllGot(manualToGet.length + toGet.length > 0))}
              className="kicker text-ink-soft hover:text-terracotta"
            >
              {manualToGet.length + toGet.length > 0 ? "Mark all got" : "Clear all"}
            </button>
          ) : null}
        </div>

        <ul className="mt-3 space-y-1.5">
          {toGet.map((g) => (
            <li key={g.ingredientId} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={false}
                onChange={() => run(() => toggleIngredientGot(g.ingredientId))}
                aria-label={`Got ${g.name}`}
              />
              <span className="text-ink">
                {g.name}
                {g.amounts.length ? (
                  <span className="text-ink-soft"> ({g.amounts.join(" · ")})</span>
                ) : null}
              </span>
            </li>
          ))}
          {manualToGet.map((m) => (
            <li key={m._key} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={false}
                onChange={() => run(() => toggleManualItem(m._key))}
                aria-label={`Got ${m.name}`}
              />
              <span className="flex-1 text-ink">{m.name}</span>
              <button
                type="button"
                onClick={() => run(() => deleteManualItem(m._key))}
                aria-label={`Delete ${m.name}`}
                className="kicker text-ink-soft hover:text-clay"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = newItem.trim();
            if (!t) return;
            run(async () => {
              await addManualItem(t);
              setNewItem("");
            });
          }}
          className="mt-3 flex items-center gap-3"
        >
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            maxLength={120}
            aria-label="Add a grocery item"
            placeholder="Add an item (e.g. milk for coffee)…"
            className="flex-1 border-b border-ink/25 bg-transparent pb-1 text-ink placeholder:text-ink-soft/60 focus:border-terracotta"
          />
          <button type="submit" className="kicker text-terracotta hover:text-terracotta-deep">
            Add
          </button>
        </form>

        {got.length + manualGot.length > 0 ? (
          <div className="mt-6">
            <p className="kicker text-ink-soft">Got it</p>
            <ul className="mt-2 space-y-1.5">
              {got.map((g) => (
                <li key={g.ingredientId} className="flex items-center gap-3 text-ink-soft">
                  <input
                    type="checkbox"
                    checked
                    onChange={() => run(() => toggleIngredientGot(g.ingredientId))}
                    aria-label={`Un-check ${g.name}`}
                  />
                  <span className="line-through">{g.name}</span>
                </li>
              ))}
              {manualGot.map((m) => (
                <li key={m._key} className="flex items-center gap-3 text-ink-soft">
                  <input
                    type="checkbox"
                    checked
                    onChange={() => run(() => toggleManualItem(m._key))}
                    aria-label={`Un-check ${m.name}`}
                  />
                  <span className="flex-1 line-through">{m.name}</span>
                  <button
                    type="button"
                    onClick={() => run(() => deleteManualItem(m._key))}
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
      </section>
    </div>
  );
}
