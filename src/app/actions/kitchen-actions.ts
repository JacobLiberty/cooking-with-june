"use server";

import { revalidatePath } from "next/cache";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@cvx/_generated/api";
import { client } from "@/sanity/lib/client";
import { getOrCreateEnrichedIngredient } from "@/lib/ingredients/get-or-create";
import { requireMember } from "@/lib/viewer";
import {
  RECIPE_REQUIREMENTS_QUERY,
  type RecipeRequirementDoc,
} from "@/sanity/lib/kitchen-queries";
import {
  buildMetaFor,
  buildPantryMap,
  deltasToArray,
  toRecipeLines,
} from "@/lib/kitchen/assemble";
import { recipeRequirements } from "@/lib/kitchen/requirements";
import { depletionDeltas } from "@/lib/kitchen/deplete";
import { computeNeeds } from "@/lib/kitchen/need";
import type { IngredientRequirement } from "@/lib/kitchen/types";

const reader = () => client.withConfig({ useCdn: false });
const tokenOpts = async () => {
  const token = await convexAuthNextjsToken();
  return token ? { token } : {};
};

type PantryRow = { ingredientId: string; quantityG: number };

function revalidate() {
  revalidatePath("/menu");
  revalidatePath("/shop");
  revalidatePath("/pantry");
  revalidatePath("/", "layout");
}

// ── Plan ────────────────────────────────────────────────────────────────────

export async function addToPlan(recipeId: string, scale = 1) {
  await requireMember();
  await fetchMutation(api.plan.addToPlan, { recipeId, scale }, await tokenOpts());
  revalidate();
}

export async function removeFromPlan(recipeId: string) {
  await requireMember();
  const opts = await tokenOpts();
  await fetchMutation(api.plan.removeFromPlan, { recipeId }, opts);
  await reconcileStale(opts);
  revalidate();
}

export async function setScale(recipeId: string, scale: number) {
  await requireMember();
  await fetchMutation(api.plan.setScale, { recipeId, scale }, await tokenOpts());
  revalidate();
}

// ── Buy / Cook ────────────────────────────────────────────────────────────────

/**
 * Check an item off the list: add the resolved buy quantity (canonical, whole
 * number) to the pantry and drop the item's manual/override row. A null
 * quantity means nothing resolvable was known — the row clears with no pantry
 * write.
 */
export async function markBought(ingredientId: string, buyQuantityG: number | null) {
  await requireMember();
  if (buyQuantityG != null && (!Number.isInteger(buyQuantityG) || buyQuantityG <= 0)) {
    throw new Error("Buy quantity must be a positive whole number");
  }
  const opts = await tokenOpts();
  if (buyQuantityG != null) {
    await fetchMutation(api.pantry.adjustPantry, { ingredientId, deltaG: buyQuantityG }, opts);
  }
  await fetchMutation(api.grocery.removeBought, { ingredientId }, opts);
  await reconcileStale(opts);
  revalidate();
}

export async function cook(recipeId: string, usedOptionalIds: string[] = []) {
  await requireMember();
  const opts = await tokenOpts();
  const planRows = (await fetchQuery(api.plan.plan, {}, opts)) as { recipeId: string; scale: number }[];
  const scale = planRows.find((p) => p.recipeId === recipeId)?.scale ?? 1;
  const docs = (await reader().fetch<RecipeRequirementDoc[]>(RECIPE_REQUIREMENTS_QUERY, {
    ids: [recipeId],
  })) ?? [];
  const lines = docs[0]?.lines ?? [];
  const metaFor = buildMetaFor(lines);
  const { requirements } = recipeRequirements(toRecipeLines(lines), scale, metaFor);
  const deltas = deltasToArray(depletionDeltas(requirements, new Set(usedOptionalIds)));
  await fetchMutation(api.cook.cook, { recipeId, at: Date.now(), deltas }, opts);
  await reconcileStale(opts);
  revalidate();
}

// ── Manual grocery + pantry corrections ───────────────────────────────────────

export async function addShopItemByName(name: string) {
  await requireMember();
  const ingredientId = await getOrCreateEnrichedIngredient(name);
  await fetchMutation(api.grocery.addManualItem, { ingredientId }, await tokenOpts());
  revalidate();
  return { ingredientId };
}

export async function addManualItem(
  ingredientId: string,
  manualQuantity?: { quantity: number; unit: string },
) {
  await requireMember();
  await fetchMutation(api.grocery.addManualItem, { ingredientId, manualQuantity }, await tokenOpts());
  revalidate();
}

export async function removeManualItem(ingredientId: string) {
  await requireMember();
  await fetchMutation(api.grocery.removeManualItem, { ingredientId }, await tokenOpts());
  revalidate();
}

export async function skipItem(ingredientId: string) {
  await requireMember();
  await fetchMutation(api.grocery.skip, { ingredientId }, await tokenOpts());
  revalidate();
}

export async function unskipItem(ingredientId: string) {
  await requireMember();
  await fetchMutation(api.grocery.unskip, { ingredientId }, await tokenOpts());
  revalidate();
}

export async function setPantryQuantity(ingredientId: string, quantityG: number) {
  await requireMember();
  const opts = await tokenOpts();
  await fetchMutation(api.pantry.setPantryQuantity, { ingredientId, quantityG }, opts);
  await reconcileStale(opts);
  revalidate();
}

export async function setBuyQuantity(ingredientId: string, buyQuantityG: number) {
  await requireMember();
  await fetchMutation(api.grocery.setBuyQuantity, { ingredientId, buyQuantityG }, await tokenOpts());
  revalidate();
}

/** "Out of it" — remove the pantry row. Undo is a client-side re-set. */
export async function depletePantryItem(ingredientId: string) {
  await requireMember();
  await fetchMutation(api.pantry.depleteItem, { ingredientId }, await tokenOpts());
  revalidate();
}

// ── Stale reconciliation ──────────────────────────────────────────────────────

/**
 * Clear `skip` and `override` rows whose ingredient no longer has a positive
 * plan need (e.g. the recipe was unplanned or the pantry was stocked).
 * Recomputes needs server-side.
 */
async function reconcileStale(opts: { token?: string }) {
  const [planRows, pantryRows, groceryRows] = await Promise.all([
    fetchQuery(api.plan.plan, {}, opts) as Promise<{ recipeId: string; scale: number }[]>,
    fetchQuery(api.pantry.pantry, {}, opts) as Promise<PantryRow[]>,
    fetchQuery(api.grocery.grocery, {}, opts) as Promise<
      { ingredientId: string; source: "manual" | "skip" | "override" }[]
    >,
  ]);
  const staleCandidates = groceryRows
    .filter((g) => g.source === "skip" || g.source === "override")
    .map((g) => g.ingredientId);
  if (staleCandidates.length === 0) return;

  const docs = (await reader().fetch<RecipeRequirementDoc[]>(RECIPE_REQUIREMENTS_QUERY, {
    ids: planRows.map((p) => p.recipeId),
  })) ?? [];
  const scaleById = new Map(planRows.map((p) => [p.recipeId, p.scale]));
  const all: IngredientRequirement[] = [];
  for (const doc of docs) {
    const lines = doc.lines ?? [];
    const { requirements } = recipeRequirements(toRecipeLines(lines), scaleById.get(doc._id) ?? 1, buildMetaFor(lines));
    all.push(...requirements);
  }
  const needs = computeNeeds(all, buildPantryMap(pantryRows));
  const neededIds = new Set(needs.map((n) => n.ingredientId));
  const stale = staleCandidates.filter((id) => !neededIds.has(id));
  if (stale.length > 0) {
    await fetchMutation(api.grocery.clearStale, { ingredientIds: stale }, opts);
  }
}
