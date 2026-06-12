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
import { planSeed, pantrySeed, resolveManualItems } from "@/lib/kitchen/migrate";

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
  groceryAdded: { sourceName: string; catalogName: string }[];
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

  // ── Resolve manual items (location-aware, plural-matching) ─
  const manualItems = source.manualItems ?? [];
  const catalog = manualItems.length
    ? (await reader().fetch<CatalogNameRow[]>(INGREDIENT_NAMES_QUERY)) ?? []
    : [];
  const resolutions = resolveManualItems(manualItems, catalog);

  // ── Pantry id set: old id-set PLUS pantry-location manual items ──
  const pantryManualIds = resolutions
    .filter((r) => r.location === "pantry" && r.ingredientId)
    .map((r) => r.ingredientId as string);
  const pantryIds = Array.from(new Set([...(source.pantryIngredients ?? []), ...pantryManualIds]));

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

  // ── Grocery: grocery-location matched items ──────────────
  const groceryRes = resolutions.filter(
    (r): r is typeof r & { ingredientId: string; catalogName: string } =>
      r.location === "grocery" && r.ingredientId !== null,
  );
  for (const r of groceryRes) {
    await fetchMutation(api.grocery.addManualItem, { ingredientId: r.ingredientId }, opts);
  }
  const groceryAdded = groceryRes.map((r) => ({
    sourceName: r.sourceName,
    catalogName: r.catalogName,
  }));

  const unmappedManual = resolutions.filter((r) => !r.ingredientId).map((r) => r.sourceName);

  return {
    seededPlan: plan,
    seededPantry: pantry,
    skippedPantry,
    groceryAdded,
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
