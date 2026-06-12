"use client";

import { useState, useTransition } from "react";
import {
  runPantryMigration,
  correctPantryQuantity,
  type MigrationReview,
} from "@/app/actions/migrate-actions";

type SeededPantry = MigrationReview["seededPantry"][number];

function PantryRow({ item }: { item: SeededPantry }) {
  const [value, setValue] = useState(String(item.quantityG));
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [pending, startTransition] = useTransition();
  const unit = item.canonicalUnitKind === "count" ? "ct" : "g";

  function save() {
    setStatus("idle");
    startTransition(async () => {
      const res = await correctPantryQuantity(item.ingredientId, Number(value));
      setStatus(res.ok ? "saved" : "error");
    });
  }

  return (
    <li className="flex items-center gap-2">
      <span className="min-w-40">{item.name}</span>
      <input
        type="number"
        min={0}
        step="any"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setStatus("idle");
        }}
        className="w-24 rounded border border-ink/20 px-2 py-1"
      />
      <span className="text-ink-soft">{unit}</span>
      <button
        onClick={save}
        disabled={pending}
        className="kicker rounded-full border border-terracotta px-3 py-1 text-terracotta hover:bg-terracotta hover:text-paper disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {status === "saved" ? <span className="text-green-700">✓</span> : null}
      {status === "error" ? <span className="text-red-600">!</span> : null}
    </li>
  );
}

export function MigrateRunner() {
  const [review, setReview] = useState<MigrationReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      try {
        setReview(await runPantryMigration());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Migration failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      <button
        onClick={run}
        disabled={pending}
        className="kicker rounded-full border border-terracotta px-4 py-2 text-terracotta hover:bg-terracotta hover:text-paper disabled:opacity-50"
      >
        {pending ? "Migrating…" : "Run migration"}
      </button>
      {error ? <p className="text-red-600">{error}</p> : null}
      {review ? (
        <div className="space-y-3 text-sm">
          <p>Seeded {review.seededPlan.length} planned recipes.</p>
          <div>
            <p className="font-semibold">
              Seeded pantry ({review.seededPantry.length}) — edit any quantity and Save:
            </p>
            <ul className="space-y-2 pl-1">
              {review.seededPantry.map((p) => (
                <PantryRow key={p.ingredientId} item={p} />
              ))}
            </ul>
          </div>
          {review.groceryAdded.length ? (
            <div>
              <p className="font-semibold">Added to grocery list:</p>
              <ul className="list-disc pl-5">
                {review.groceryAdded.map((g) => (
                  <li key={g.sourceName}>{g.sourceName} → {g.catalogName}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {review.skippedPantry.length ? (
            <div>
              <p className="font-semibold">Skipped pantry (run enrichment, then re-run):</p>
              <ul className="list-disc pl-5">
                {review.skippedPantry.map((s) => (
                  <li key={s.ingredientId}>{s.name} — {s.reason}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {review.unmappedManual.length ? (
            <div>
              <p className="font-semibold">Unmapped manual items (re-add via catalog):</p>
              <ul className="list-disc pl-5">
                {review.unmappedManual.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
