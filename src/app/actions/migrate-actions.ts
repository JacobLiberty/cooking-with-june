"use server";

import { fetchMutation } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@cvx/_generated/api";
import { client } from "@/sanity/lib/client";
import { getViewer } from "@/lib/viewer";
import {
  MIGRATION_SOURCE_QUERY,
  INGREDIENTS_BY_IDS_QUERY,
  INGREDIENT_NAMES_QUERY,
  type MigrationSource,
  type IngredientMetaDoc,
  type CatalogNameRow,
} from "@/sanity/lib/migration-queries";
import { planSeed, pantrySeed, matchManualItems } from "@/lib/kitchen/migrate";

const reader = () => client.withConfig({ useCdn: false });

/** Resolve the owner's Convex auth token; throws unless the caller is the owner. */
async function requireOwnerOpts(): Promise<{ token?: string }> {
  const viewer = await getViewer();
  if (viewer.role !== "owner") {
    throw new Error("Only the household owner can run the migration");
  }
  const token = await convexAuthNextjsToken();
  return token ? { token } : {};
}

export type MigrationReview = {
  seededPlan: { recipeId: string; scale: number }[];
  seededPantry: { ingredientId: string; name: string; quantityG: number; canonicalUnitKind: string }[];
  skippedPantry: { ingredientId: string; name: string; reason: string }[];
  matchedManual: { name: string; ingredientId: string }[];
  unmappedManual: string[];
};

export async function runPantryMigration(): Promise<MigrationReview> {
  const opts = await requireOwnerOpts();

  const source = (await reader().fetch<MigrationSource>(MIGRATION_SOURCE_QUERY)) ?? {
    recipeIds: [],
    recipeScales: [],
    pantryIngredients: [],
    manualItems: [],
  };

  // ── Plan ────────────────────────────────────────────────
  const plan = planSeed(source.recipeIds, source.recipeScales);
  for (const p of plan) {
    await fetchMutation(api.plan.addToPlan, { recipeId: p.recipeId, scale: p.scale }, opts);
  }

  // ── Pantry (seed at restock defaults) ───────────────────
  const pantryIds = source.pantryIngredients ?? [];
  const docs = pantryIds.length
    ? (await reader().fetch<IngredientMetaDoc[]>(INGREDIENTS_BY_IDS_QUERY, { ids: pantryIds })) ?? []
    : [];
  const { seed: pantry, skipped: skippedPantry } = pantrySeed(docs);
  for (const item of pantry) {
    await fetchMutation(
      api.pantry.setPantryQuantity,
      { ingredientId: item.ingredientId, quantityG: item.quantityG },
      opts,
    );
  }

  // ── Manual items (name-match to catalog) ────────────────
  const manualItems = source.manualItems ?? [];
  const catalog = manualItems.length
    ? (await reader().fetch<CatalogNameRow[]>(INGREDIENT_NAMES_QUERY)) ?? []
    : [];
  const { matched, unmapped: unmappedManual } = matchManualItems(manualItems, catalog);
  for (const m of matched) {
    await fetchMutation(api.grocery.addManualItem, { ingredientId: m.ingredientId }, opts);
  }

  return {
    seededPlan: plan,
    seededPantry: pantry,
    skippedPantry,
    matchedManual: matched,
    unmappedManual,
  };
}

/**
 * Owner-only: correct a seeded pantry quantity from the migration review list.
 * Sets the absolute canonical amount (grams for mass/volume, count for count-kind).
 */
export async function correctPantryQuantity(
  ingredientId: string,
  quantityG: number,
): Promise<{ ok: boolean; error?: string }> {
  const opts = await requireOwnerOpts();
  if (!Number.isFinite(quantityG) || quantityG < 0) {
    return { ok: false, error: "Quantity must be a non-negative number" };
  }
  await fetchMutation(api.pantry.setPantryQuantity, { ingredientId, quantityG }, opts);
  return { ok: true };
}
