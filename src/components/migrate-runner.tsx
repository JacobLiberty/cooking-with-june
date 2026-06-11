"use client";

import { useState, useTransition } from "react";
import { runPantryMigration, type MigrationReview } from "@/app/actions/migrate-actions";

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
            <p className="font-semibold">Seeded pantry ({review.seededPantry.length}):</p>
            <ul className="list-disc pl-5">
              {review.seededPantry.map((p) => (
                <li key={p.ingredientId}>
                  {p.name} — {p.quantityG} {p.canonicalUnitKind === "count" ? "ct" : "g"}
                </li>
              ))}
            </ul>
          </div>
          {review.skippedPantry.length ? (
            <div>
              <p className="font-semibold">Skipped pantry (fix in Studio):</p>
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
