"use client";

import { useMemo, useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import {
  markBought,
  skipItem,
  removeManualItem,
  addShopItemByName,
} from "@/app/actions/kitchen-actions";
import {
  buildShopItems,
  groupShopItems,
  type ShopNeed,
  type ShopManual,
} from "@/lib/kitchen/shop-grouping";
import { ShopItemRow } from "@/components/shop-item-row";
import { AddShopItem } from "@/components/add-shop-item";
import type { IngredientOption } from "@/sanity/types";

export function ShopView({
  needs,
  manual,
  catalog,
}: {
  needs: ShopNeed[];
  manual: ShopManual[];
  catalog: IngredientOption[];
}) {
  const [items, setItems] = useState(() => buildShopItems(needs, manual));
  const [shopping, setShopping] = useState(false);
  const [bought, setBought] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  const groups = useMemo(() => groupShopItems(items), [items]);
  const total = items.length;
  const doneCount = bought.size;

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

  const drop = (id: string) => setItems((xs) => xs.filter((x) => x.ingredientId !== id));
  const restore = (snapshot: typeof items) => setItems(snapshot);

  // Shopping mode keeps checked items visible (stable progress denominator) and
  // marks them done; normal mode removes the item from the list once bought.
  const buy = (id: string) => {
    if (shopping) {
      if (bought.has(id)) return;
      setBought((b) => new Set(b).add(id));
      act(
        () => markBought(id),
        () => setBought((b) => { const n = new Set(b); n.delete(id); return n; }),
      );
      return;
    }
    const snapshot = items;
    drop(id);
    act(() => markBought(id), () => restore(snapshot));
  };

  const dismiss = (id: string, source: "need" | "manual") => {
    const snapshot = items;
    drop(id);
    act(
      () => (source === "manual" ? removeManualItem(id) : skipItem(id)),
      () => restore(snapshot),
    );
  };

  const add = (name: string) => {
    act(
      async () => {
        const { ingredientId } = await addShopItemByName(name);
        // Reflect immediately as a manual row (catalog category unknown client-side
        // until the next server load; it lands in "Other" meanwhile).
        setItems((xs) =>
          xs.some((x) => x.ingredientId === ingredientId)
            ? xs
            : [
                ...xs,
                {
                  ingredientId,
                  name,
                  category: null,
                  optional: false,
                  source: "manual" as const,
                  amount: null,
                  canonicalUnitKind: null,
                  manualQuantity: null,
                },
              ],
        );
      },
      () => {},
    );
    toast({ message: `Added ${name}` });
  };

  const empty = total === 0;

  return (
    <div aria-busy={pending}>
      <div className="mt-6 flex items-center justify-between gap-3">
        <span className="kicker text-ink-soft" aria-live="polite">
          {shopping ? `${doneCount} of ${total} done` : `${total} ${total === 1 ? "item" : "items"}`}
        </span>
        {!empty ? (
          <button
            type="button"
            aria-pressed={shopping}
            onClick={() => {
              setShopping((v) => !v);
              setBought(new Set());
            }}
            className={`kicker rounded-full border px-4 py-2 transition-colors ${
              shopping
                ? "border-terracotta bg-terracotta text-paper"
                : "border-terracotta/40 text-terracotta hover:bg-terracotta-wash"
            }`}
          >
            {shopping ? "Done shopping" : "Start shopping"}
          </button>
        ) : null}
      </div>

      {shopping ? (
        <div
          className="mt-3 h-1 w-full overflow-hidden rounded-full bg-clay-wash"
          role="progressbar"
          aria-valuenow={doneCount}
          aria-valuemin={0}
          aria-valuemax={total}
        >
          <div
            className="h-full bg-terracotta transition-all"
            style={{ width: total ? `${(doneCount / total) * 100}%` : "0%" }}
          />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 text-sm text-terracotta-deep">
          {error}
        </p>
      ) : null}

      {empty ? (
        <p className="mt-6 text-ink-soft">
          Your shopping list is empty — plan some recipes or add an item below.
        </p>
      ) : (
        <div className="mt-4 space-y-6">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`group-${group.key}`}>
              <h2 id={`group-${group.key}`} className="kicker text-terracotta">
                {group.label}
              </h2>
              <ul className="mt-2">
                {group.items.map((item) => (
                  <ShopItemRow
                    key={item.ingredientId}
                    item={item}
                    big={shopping}
                    checked={bought.has(item.ingredientId)}
                    onBuy={() => buy(item.ingredientId)}
                    onDismiss={() => dismiss(item.ingredientId, item.source)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {!shopping ? <AddShopItem catalog={catalog} onAdd={add} /> : null}
    </div>
  );
}
