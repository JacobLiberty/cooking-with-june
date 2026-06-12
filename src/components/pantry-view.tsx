"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { setPantryQuantity, setRestockOverride } from "@/app/actions/kitchen-actions";
import { PantryRow, type PantryRowData } from "@/components/pantry-row";

const byName = (a: PantryRowData, b: PantryRowData) => a.name.localeCompare(b.name);

export function PantryView({ rows: initialRows }: { rows: PantryRowData[] }) {
  const [rows, setRows] = useState(() => [...initialRows].sort(byName));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
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
      } catch {
        revert();
        setError("Couldn't save that — please try again.");
      }
    });
  };

  const patch = (id: string, next: Partial<PantryRowData>) =>
    setRows((rs) => rs.map((r) => (r.ingredientId === id ? { ...r, ...next } : r)));

  const setQuantity = (row: PantryRowData, next: number) => {
    const prev = row.quantityG;
    patch(row.ingredientId, { quantityG: next });
    act(
      () => setPantryQuantity(row.ingredientId, next),
      () => patch(row.ingredientId, { quantityG: prev }),
    );
  };

  const setRestock = (row: PantryRowData, restock: { quantity: number; unit: string }) => {
    const prev = row.restockOverride;
    patch(row.ingredientId, { restockOverride: restock });
    act(
      () => setRestockOverride(row.ingredientId, restock),
      () => patch(row.ingredientId, { restockOverride: prev }),
      () => toast({ message: `Updated restock for ${row.name}` }),
    );
  };

  const clearRestock = (row: PantryRowData) => {
    const prev = row.restockOverride;
    patch(row.ingredientId, { restockOverride: null });
    act(
      () => setRestockOverride(row.ingredientId, undefined),
      () => patch(row.ingredientId, { restockOverride: prev }),
      () => toast({ message: `Reset restock for ${row.name}` }),
    );
  };

  if (rows.length === 0) {
    return (
      <p className="mt-6 text-ink-soft">
        Your pantry is empty — check things off your shopping list and they&rsquo;ll land here.
      </p>
    );
  }

  return (
    <div aria-busy={pending}>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-terracotta-deep">
          {error}
        </p>
      ) : null}
      <ul className="mt-4">
        {rows.map((row) => (
          <PantryRow
            key={row.ingredientId}
            row={row}
            onSetQuantity={(next) => setQuantity(row, next)}
            onSetRestock={(restock) => setRestock(row, restock)}
            onClearRestock={() => clearRestock(row)}
          />
        ))}
      </ul>
    </div>
  );
}
