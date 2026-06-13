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
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows),
    [rows, q],
  );
  const groups = useMemo(() => groupPantryRows(filtered), [filtered]);

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
      <div className="mt-5">
        <label className="flex items-center gap-2 border-b border-ink/20 pb-1 focus-within:border-terracotta">
          <span className="sr-only">Search the pantry</span>
          <SearchIcon />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the pantry…"
            aria-label="Search the pantry"
            className="w-full bg-transparent text-ink placeholder:text-ink-soft focus:outline-none"
          />
        </label>
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-terracotta-deep">
          {error}
        </p>
      ) : null}

      {groups.length === 0 ? (
        <p className="mt-6 text-ink-soft">No ingredients match &ldquo;{query.trim()}&rdquo;.</p>
      ) : (
        <div className="mt-5 space-y-7">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`pantry-${group.key}`}>
              <h2
                id={`pantry-${group.key}`}
                className="flex items-baseline justify-between border-b-2 border-terracotta/30 pb-1 font-display text-lg text-terracotta"
              >
                {group.label}
                <span className="kicker text-ink-soft">{group.rows.length}</span>
              </h2>
              <ul className="mt-1.5">
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
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 text-ink-soft"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}
