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
      await write
        .patch(doc._id)
        .set({
          canonicalUnitKind: m.canonicalUnitKind,
          ...(m.density != null ? { density: m.density } : {}),
          ...(m.avgUnitGrams != null ? { avgUnitGrams: m.avgUnitGrams } : {}),
          restockQuantity: m.restockQuantity,
          category: m.category,
        })
        .commit();
      written++;
    }
  }

  console.log(`Done. Wrote ${written}; skipped ${skipped.length}.`);
  if (skipped.length) console.log("Needs manual review in Studio:\n" + skipped.join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
