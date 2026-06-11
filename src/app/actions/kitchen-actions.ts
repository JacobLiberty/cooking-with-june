"use server";

import { revalidatePath } from "next/cache";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@cvx/_generated/api";
import { client } from "@/sanity/lib/client";
import { requireMember } from "@/lib/viewer";
import {
  RECIPE_REQUIREMENTS_QUERY,
  INGREDIENT_RESTOCK_QUERY,
  type RecipeRequirementDoc,
  type IngredientRestockDoc,
} from "@/sanity/lib/kitchen-queries";
import {
  buildMetaFor,
  buildPantryMap,
  deltasToArray,
  toIngredientInfo,
  toRecipeLines,
  restockToCanonical,
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

type PantryRow = { ingredientId: string; quantityG: number; restockOverride: { quantity: number; unit: string } | null };

function revalidate() {
  revalidatePath("/plan");
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
  await reconcileSkips(opts);
  revalidate();
}

export async function setScale(recipeId: string, scale: number) {
  await requireMember();
  await fetchMutation(api.plan.setScale, { recipeId, scale }, await tokenOpts());
  revalidate();
}

// ── Buy / Cook ────────────────────────────────────────────────────────────────

export async function markBought(ingredientId: string) {
  await requireMember();
  const opts = await tokenOpts();
  const [pantryRows, ing] = await Promise.all([
    fetchQuery(api.pantry.pantry, {}, opts) as Promise<PantryRow[]>,
    reader().fetch<IngredientRestockDoc | null>(INGREDIENT_RESTOCK_QUERY, { id: ingredientId }),
  ]);
  if (ing) {
    const info = toIngredientInfo(ing);
    const override = pantryRows.find((p) => p.ingredientId === ingredientId)?.restockOverride ?? null;
    const restock = override ?? ing.restockQuantity ?? null;
    const amount = info ? restockToCanonical(restock, info, ing.name) : null;
    if (amount != null && amount > 0) {
      await fetchMutation(api.pantry.adjustPantry, { ingredientId, deltaG: amount }, opts);
    }
  }
  await fetchMutation(api.grocery.removeManualItem, { ingredientId }, opts);
  await reconcileSkips(opts);
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
  await reconcileSkips(opts);
  revalidate();
}

// ── Manual grocery + pantry corrections ───────────────────────────────────────

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
  await reconcileSkips(opts);
  revalidate();
}

export async function setRestockOverride(
  ingredientId: string,
  restock?: { quantity: number; unit: string },
) {
  await requireMember();
  await fetchMutation(api.pantry.setRestockOverride, { ingredientId, restock }, await tokenOpts());
  revalidate();
}

// ── Skip reconciliation ───────────────────────────────────────────────────────

/**
 * Clear `skip` rows whose ingredient no longer has a positive plan need (e.g. the
 * recipe was unplanned or the pantry was stocked). Recomputes needs server-side.
 */
async function reconcileSkips(opts: { token?: string }) {
  const [planRows, pantryRows, groceryRows] = await Promise.all([
    fetchQuery(api.plan.plan, {}, opts) as Promise<{ recipeId: string; scale: number }[]>,
    fetchQuery(api.pantry.pantry, {}, opts) as Promise<PantryRow[]>,
    fetchQuery(api.grocery.grocery, {}, opts) as Promise<{ ingredientId: string; source: "manual" | "skip" }[]>,
  ]);
  const skipIds = groceryRows.filter((g) => g.source === "skip").map((g) => g.ingredientId);
  if (skipIds.length === 0) return;

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
  const stale = skipIds.filter((id) => !neededIds.has(id));
  if (stale.length > 0) {
    await fetchMutation(api.grocery.clearSkips, { ingredientIds: stale }, opts);
  }
}
