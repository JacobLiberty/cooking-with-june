/**
 * One-time admin pass: assign stock metadata (canonicalUnitKind, density /
 * avgUnitGrams, restockQuantity, category) to every catalog ingredient that
 * lacks it, using Claude with a heuristic fallback. Idempotent.
 *
 *   npm run enrich:ingredients            # enrich only ingredients missing data
 *   npm run enrich:ingredients -- --force # re-enrich everything
 *   npm run enrich:ingredients -- --dry   # print planned writes, write nothing
 *
 * Requires ANTHROPIC_API_KEY and SANITY_API_WRITE_TOKEN in .env.local.
 */
import { client } from "@/sanity/lib/client";
import { getWriteClient } from "@/sanity/lib/write-client";
import { selectIngredientsNeedingEnrichment } from "@/lib/enrichment/select";
import { enrichBatch } from "@/lib/enrichment/client";
import { validateEnrichmentResult } from "@/lib/enrichment/validate";
import { mergeWithFallback } from "@/lib/enrichment/fallback";
import type { IngredientDoc } from "@/lib/enrichment/types";

const BATCH = 25;

async function main() {
  const force = process.argv.includes("--force");
  const dry = process.argv.includes("--dry");

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required (set it in .env.local)");
  }
  if (!dry && !process.env.SANITY_API_WRITE_TOKEN) {
    throw new Error("SANITY_API_WRITE_TOKEN is required for writes (or use --dry)");
  }

  const docs = await client.fetch<IngredientDoc[]>(
    `*[_type == "ingredient"]{ _id, name, category, canonicalUnitKind, density, avgUnitGrams, restockQuantity }`,
  );
  const todo = selectIngredientsNeedingEnrichment(docs, { force });
  console.log(`Catalog: ${docs.length} ingredients, ${todo.length} need enrichment.`);
  if (todo.length === 0) return;

  const write = getWriteClient();
  let written = 0;
  const skipped: string[] = [];

  for (let i = 0; i < todo.length; i += BATCH) {
    const slice = todo.slice(i, i + BATCH);
    const batchNum = Math.floor(i / BATCH) + 1;
    const batchTotal = Math.ceil(todo.length / BATCH);
    console.log(`Batch ${batchNum}/${batchTotal}: enriching ${slice.length}…`);
    const byName = new Map(slice.map((d) => [d.name.toLowerCase(), d]));
    const items = await enrichBatch(slice.map((d) => d.name));

    for (const raw of items) {
      const doc = byName.get(String(raw.name).toLowerCase());
      if (!doc) continue;
      // RawEnrichmentItem is { name } & Record<string, unknown>; cast to the
      // first parameter of mergeWithFallback (FallbackHint) so the generic
      // constraint is satisfied while preserving all spread fields.
      const merged = mergeWithFallback(raw as Parameters<typeof mergeWithFallback>[0], doc.name);
      const result = validateEnrichmentResult(merged);
      if (!result.ok) {
        skipped.push(`${doc.name}: ${result.errors.join("; ")}`);
        continue;
      }
      const m = result.value;
      if (dry) {
        console.log(`DRY ${doc.name} ->`, JSON.stringify(m));
        continue;
      }
      // Unset the cross-kind field so re-enriching (e.g. via --force) a doc that
      // changed kind doesn't leave a stale density/avgUnitGrams behind.
      const unsetFields = [
        ...(m.canonicalUnitKind !== "volume" ? ["density"] : []),
        ...(m.canonicalUnitKind !== "count" ? ["avgUnitGrams"] : []),
      ];
      let patch = write.patch(doc._id).set({
        canonicalUnitKind: m.canonicalUnitKind,
        ...(m.density != null ? { density: m.density } : {}),
        ...(m.avgUnitGrams != null ? { avgUnitGrams: m.avgUnitGrams } : {}),
        restockQuantity: m.restockQuantity,
        category: m.category,
      });
      if (unsetFields.length > 0) patch = patch.unset(unsetFields);
      await patch.commit();
      written++;
    }
  }

  console.log(`Done. Wrote ${written}; skipped ${skipped.length}.`);
  if (skipped.length) console.log("Needs manual review in Studio:\n" + skipped.join("\n"));
}

// A batch-level failure aborts the run; re-running is safe because
// selectIngredientsNeedingEnrichment() skips already-enriched docs.
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
