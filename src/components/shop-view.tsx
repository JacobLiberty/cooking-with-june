"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import {
  markBought,
  skipItem,
  removeManualItem,
  addShopItemByName,
  setBuyQuantity,
} from "@/app/actions/kitchen-actions";
import {
  buildShopItems,
  groupShopItems,
  type ShopItem,
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
  const [bought, setBought] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  // Ref guard prevents double-buy from rapid clicks before React flushes state.
  const buyingRef = useRef<Set<string>>(new Set());

  const groups = useMemo(() => groupShopItems(items), [items]);
  const total = items.length;
  const doneCount = Math.min(bought.size, total);

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

  const patchItem = (id: string, next: Partial<ShopItem>) =>
    setItems((xs) => xs.map((x) => (x.ingredientId === id ? { ...x, ...next } : x)));

  // One behavior: check → pantry write; row stays, crossed out, until cleared.
  const buy = (item: ShopItem) => {
    const id = item.ingredientId;
    if (bought.has(id) || buyingRef.current.has(id)) return;
    buyingRef.current = new Set(buyingRef.current).add(id);
    setBought((b) => new Set(b).add(id));
    setExpanded((e) => (e === id ? null : e));
    act(
      () => markBought(id, item.buyQuantityG),
      () => {
        buyingRef.current = (() => { const n = new Set(buyingRef.current); n.delete(id); return n; })();
        setBought((b) => { const n = new Set(b); n.delete(id); return n; });
      },
    );
  };

  const dismiss = (id: string, source: "need" | "manual") => {
    const snapshot = items;
    setItems((xs) => xs.filter((x) => x.ingredientId !== id));
    act(
      () => (source === "manual" ? removeManualItem(id) : skipItem(id)),
      () => setItems(snapshot),
    );
  };

  const changeBuyQuantity = (item: ShopItem, next: number) => {
    const prev = item.buyQuantityG;
    patchItem(item.ingredientId, { buyQuantityG: next });
    act(
      () => setBuyQuantity(item.ingredientId, next),
      () => patchItem(item.ingredientId, { buyQuantityG: prev }),
    );
  };

  const clearChecked = () => {
    setItems((xs) => xs.filter((x) => !bought.has(x.ingredientId)));
    setBought(new Set());
    buyingRef.current = new Set();
  };

  const add = (name: string) => {
    act(
      async () => {
        const { ingredientId } = await addShopItemByName(name);
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
                  buyQuantityG: null,
                },
              ],
        );
        toast({ message: `Added ${name}` });
      },
      () => {},
    );
  };

  const empty = total === 0;

  return (
    <div aria-busy={pending}>
      <div className="mt-6">
        <span className="kicker text-ink-soft" aria-live="polite">
          {doneCount > 0
            ? `${doneCount} of ${total} in the basket`
            : `${total} ${total === 1 ? "item" : "items"}`}
        </span>
        {!empty ? (
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
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-terracotta-deep">
          {error}
        </p>
      ) : null}

      <AddShopItem catalog={catalog} onAdd={add} />

      {empty ? (
        <p className="mt-6 text-ink-soft">
          Your shopping list is empty — plan some recipes or add an item above.
        </p>
      ) : (
        <>
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
                      checked={bought.has(item.ingredientId)}
                      expanded={expanded === item.ingredientId}
                      onBuy={() => buy(item)}
                      onDismiss={() => dismiss(item.ingredientId, item.source)}
                      onToggleExpand={() =>
                        setExpanded((e) => (e === item.ingredientId ? null : item.ingredientId))
                      }
                      onSetBuyQuantity={(next) => changeBuyQuantity(item, next)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {doneCount > 0 ? (
            <div className="mt-6 text-right">
              <button
                type="button"
                onClick={clearChecked}
                className="kicker text-ink-soft underline-offset-2 hover:text-terracotta hover:underline"
              >
                Clear checked-off items
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
