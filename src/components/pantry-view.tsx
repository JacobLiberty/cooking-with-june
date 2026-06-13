"use client";

import { useMemo, useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import {
  setPantryQuantity,
  addManualItem,
  depletePantryItem,
} from "@/app/actions/kitchen-actions";
import { groupPantryRows } from "@/lib/kitchen/pantry-grouping";
import { PantryRow, type PantryRowData } from "@/components/pantry-row";

export function PantryView({ rows: initialRows }: { rows: PantryRowData[] }) {
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  const groups = useMemo(() => groupPantryRows(rows), [rows]);

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

  const addToList = (row: PantryRowData) => {
    if (row.onList) return;
    patch(row.ingredientId, { onList: true });
    act(
      () => addManualItem(row.ingredientId),
      () => patch(row.ingredientId, { onList: false }),
      () => toast({ message: `${row.name} added to your list` }),
    );
  };

  const restore = (row: PantryRowData) => {
    setRows((rs) =>
      rs.some((r) => r.ingredientId === row.ingredientId) ? rs : [...rs, row],
    );
    act(
      () => setPantryQuantity(row.ingredientId, row.quantityG),
      () => setRows((rs) => rs.filter((r) => r.ingredientId !== row.ingredientId)),
    );
  };

  const deplete = (row: PantryRowData) => {
    const snapshot = rows;
    setRows((rs) => rs.filter((r) => r.ingredientId !== row.ingredientId));
    act(
      () => depletePantryItem(row.ingredientId),
      () => setRows(snapshot),
      () =>
        toast({
          message: `${row.name} removed`,
          actions: [
            { label: "Undo", onAction: () => restore(row) },
            { label: "Add to list", onAction: () => addToList({ ...row, onList: false }) },
          ],
        }),
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
      <div className="mt-4 space-y-6">
        {groups.map((group) => (
          <section key={group.key} aria-labelledby={`pantry-${group.key}`}>
            <h2 id={`pantry-${group.key}`} className="kicker text-terracotta">
              {group.label}
            </h2>
            <ul className="mt-1">
              {group.rows.map((row) => (
                <PantryRow
                  key={row.ingredientId}
                  row={row}
                  onSetQuantity={(next) => setQuantity(row, next)}
                  onAddToList={() => addToList(row)}
                  onDeplete={() => deplete(row)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
