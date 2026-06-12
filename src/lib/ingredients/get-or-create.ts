import { client } from "@/sanity/lib/client";
import { getWriteClient } from "@/sanity/lib/write-client";
import { enrichBatch } from "@/lib/enrichment/client";
import { validateEnrichmentResult } from "@/lib/enrichment/validate";
import { fallbackMetadata } from "@/lib/enrichment/fallback";

const reader = () => client.withConfig({ useCdn: false });

/**
 * Resolve a catalog ingredient id for `name`, creating it if missing. New
 * ingredients are enriched with full stock metadata (canonicalUnitKind, density/
 * avgUnitGrams, category, restockQuantity) via Claude so the catalog stays
 * consistent with depletion math. If enrichment is unreachable or unusable, the
 * ingredient is created with name + any heuristic hint only — left without
 * category/restock so the batch `enrich:ingredients` script flags + completes it
 * later. Adding an item never hard-fails on enrichment.
 *
 * Server-only (imports the Sanity write client + Anthropic SDK).
 */
export async function getOrCreateEnrichedIngredient(name: string): Promise<string> {
  const clean = name.trim();
  if (!clean) throw new Error("Ingredient name required");

  const existing = await reader().fetch<{ _id: string } | null>(
    `*[_type == "ingredient" && lower(name) == lower($name)][0]{ _id }`,
    { name: clean },
  );
  if (existing?._id) return existing._id;

  const created = await getWriteClient().create(await buildNewIngredientDoc(clean));
  return created._id;
}

async function buildNewIngredientDoc(
  name: string,
): Promise<{ _type: "ingredient"; [key: string]: unknown }> {
  try {
    const [raw] = await enrichBatch([name]);
    const result = validateEnrichmentResult(raw);
    if (result.ok) {
      const m = result.value;
      return {
        _type: "ingredient",
        name,
        canonicalUnitKind: m.canonicalUnitKind,
        density: m.density,
        avgUnitGrams: m.avgUnitGrams,
        category: m.category,
        restockQuantity: m.restockQuantity,
      };
    }
  } catch {
    // enrichment unreachable — fall through to the heuristic-only doc below
  }
  // Minimal, flagged: name + whatever the name heuristics can infer.
  return { _type: "ingredient", name, ...fallbackMetadata(name) };
}
