"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import { setScale, removeFromPlan, cook, addManualItem } from "@/app/actions/kitchen-actions";
import { MenuRecipeRow, type MenuRow } from "@/components/menu-recipe-row";

export function MenuView({ rows }: { rows: MenuRow[] }) {
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [scaleOverride, setScaleOverride] = useState<Map<string, number>>(() => new Map());
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const act = (
    action: () => Promise<unknown>,
    revert: () => void,
    onSuccess?: () => void,
  ) => {
    setError(null);
    start(async () => {
      try {
        await action();
        onSuccess?.();
        router.refresh();
      } catch {
        revert();
        setError("Couldn't save that — please try again.");
      }
    });
  };

  const scaleOf = (row: MenuRow) => scaleOverride.get(row.recipeId) ?? row.scale;

  const changeScale = (row: MenuRow, next: number) => {
    const clamped = Math.max(1, Math.round(next));
    if (clamped === scaleOf(row)) return;
    const prev = scaleOverride;
    setScaleOverride((m) => new Map(m).set(row.recipeId, clamped));
    act(
      () => setScale(row.recipeId, clamped),
      () => setScaleOverride(prev),
    );
  };

  const remove = (row: MenuRow) => {
    setRemoved((s) => new Set(s).add(row.recipeId));
    act(
      () => removeFromPlan(row.recipeId),
      () => setRemoved((s) => { const n = new Set(s); n.delete(row.recipeId); return n; }),
    );
  };

  const madeIt = (row: MenuRow, usedOptionalIds: string[]) => {
    setRemoved((s) => new Set(s).add(row.recipeId));
    act(
      () => cook(row.recipeId, usedOptionalIds),
      () => setRemoved((s) => { const n = new Set(s); n.delete(row.recipeId); return n; }),
      () => toast({ message: `Cooked ${row.title}` }),
    );
  };

  const [addedMissing, setAddedMissing] = useState<Set<string>>(() => new Set());

  const addMissing = (ingredientId: string, name: string) => {
    setAddedMissing((s) => new Set(s).add(ingredientId));
    act(
      () => addManualItem(ingredientId),
      () => setAddedMissing((s) => { const n = new Set(s); n.delete(ingredientId); return n; }),
      () => toast({ message: `${name} added to your list` }),
    );
  };

  const visible = rows.filter((r) => !removed.has(r.recipeId));

  if (visible.length === 0) {
    return (
      <p className="mt-6 text-ink-soft">
        Nothing on the menu yet —{" "}
        <Link href="/" className="text-terracotta hover:text-terracotta-deep">
          browse the collection
        </Link>{" "}
        and add a few recipes.
      </p>
    );
  }

  return (
    <div>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-terracotta-deep">
          {error}
        </p>
      ) : null}
      <ul className="mt-4">
        {visible.map((row) => (
          <MenuRecipeRow
            key={row.recipeId}
            row={row}
            scale={scaleOf(row)}
            onScale={(next) => changeScale(row, next)}
            onRemove={() => remove(row)}
            onMadeIt={(ids) => madeIt(row, ids)}
            onAddMissing={addMissing}
            addedMissing={addedMissing}
          />
        ))}
      </ul>
    </div>
  );
}
