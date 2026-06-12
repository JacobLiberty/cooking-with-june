"use server";

import { fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@cvx/_generated/api";
import { client } from "@/sanity/lib/client";
import { requireMember } from "@/lib/viewer";
import {
  RECIPE_REQUIREMENTS_QUERY,
  INGREDIENTS_BY_IDS_QUERY,
  type RecipeRequirementDoc,
  type CatalogInfoDoc,
} from "@/sanity/lib/kitchen-queries";
import {
  buildMetaFor,
  buildPantryMap,
  toRecipeLines,
} from "@/lib/kitchen/assemble";
import { recipeRequirements } from "@/lib/kitchen/requirements";
import { computeNeeds } from "@/lib/kitchen/need";
import { recipeCoverage } from "@/lib/kitchen/cookable";
import type { IngredientRequirement } from "@/lib/kitchen/types";

const reader = () => client.withConfig({ useCdn: false });

async function fetchRequirements(ids: string[]): Promise<RecipeRequirementDoc[]> {
  if (ids.length === 0) return [];
  return (await reader().fetch(RECIPE_REQUIREMENTS_QUERY, { ids })) ?? [];
}

async function catalogInfoByIds(ids: string[]): Promise<Map<string, CatalogInfoDoc>> {
  if (ids.length === 0) return new Map();
  const docs = (await reader().fetch<CatalogInfoDoc[]>(INGREDIENTS_BY_IDS_QUERY, { ids })) ?? [];
  return new Map(docs.map((d) => [d._id, d]));
}

type PantryRow = {
  ingredientId: string;
  quantityG: number;
  restockOverride: { quantity: number; unit: string } | null;
  updatedAt: number;
};

export async function getPantryData() {
  await requireMember();
  const token = await convexAuthNextjsToken();
  const rows = (await fetchQuery(api.pantry.pantry, {}, token ? { token } : {})) as PantryRow[];
  const info = await catalogInfoByIds(rows.map((r) => r.ingredientId));
  return rows.map((r) => {
    const c = info.get(r.ingredientId);
    return {
      ingredientId: r.ingredientId,
      quantityG: r.quantityG,
      restockOverride: r.restockOverride,
      updatedAt: r.updatedAt,
      name: c?.name ?? r.ingredientId,
      canonicalUnitKind: c?.canonicalUnitKind ?? null,
      category: c?.category ?? null,
      restockDefault: c?.restockQuantity ?? null,
    };
  });
}

export async function getCookableCoverage(
  recipeIds: string[],
): Promise<Record<string, { cookable: boolean; missingRequired: number }>> {
  await requireMember();
  if (recipeIds.length === 0) return {};
  const token = await convexAuthNextjsToken();
  const [pantryRows, reqDocs] = await Promise.all([
    fetchQuery(api.pantry.pantry, {}, token ? { token } : {}) as Promise<PantryRow[]>,
    fetchRequirements(recipeIds),
  ]);
  const pantry = buildPantryMap(pantryRows);
  const out: Record<string, { cookable: boolean; missingRequired: number }> = {};
  for (const doc of reqDocs) {
    const lines = doc.lines ?? [];
    const metaFor = buildMetaFor(lines);
    // Browse cookability = "can I make this recipe as written?" → base scale 1,
    // independent of any plan scale (plan-scaled coverage lives in getPlanData).
    const { requirements } = recipeRequirements(toRecipeLines(lines), 1, metaFor);
    out[doc._id] = recipeCoverage(requirements, pantry);
  }
  return out;
}

export async function getShopData() {
  await requireMember();
  const token = await convexAuthNextjsToken();
  const opts = token ? { token } : {};
  const [planRows, pantryRows, groceryRows] = await Promise.all([
    fetchQuery(api.plan.plan, {}, opts) as Promise<{ recipeId: string; scale: number }[]>,
    fetchQuery(api.pantry.pantry, {}, opts) as Promise<PantryRow[]>,
    fetchQuery(api.grocery.grocery, {}, opts) as Promise<
      { ingredientId: string; source: "manual" | "skip"; manualQuantity: { quantity: number; unit: string } | null }[]
    >,
  ]);
  const reqDocs = await fetchRequirements(planRows.map((p) => p.recipeId));
  const scaleById = new Map(planRows.map((p) => [p.recipeId, p.scale]));

  const all: IngredientRequirement[] = [];
  for (const doc of reqDocs) {
    const lines = doc.lines ?? [];
    const metaFor = buildMetaFor(lines);
    const { requirements } = recipeRequirements(
      toRecipeLines(lines),
      scaleById.get(doc._id) ?? 1,
      metaFor,
    );
    all.push(...requirements);
  }

  const pantry = buildPantryMap(pantryRows);
  const skipped = groceryRows.filter((g) => g.source === "skip").map((g) => g.ingredientId);
  const skipSet = new Set(skipped);
  const needs = computeNeeds(all, pantry).filter((n) => !skipSet.has(n.ingredientId));
  const manual = groceryRows.filter((g) => g.source === "manual");
  return { needs, manual, skipped };
}

export async function getPlanData() {
  await requireMember();
  const token = await convexAuthNextjsToken();
  const opts = token ? { token } : {};
  const [planRows, pantryRows] = await Promise.all([
    fetchQuery(api.plan.plan, {}, opts) as Promise<{ recipeId: string; scale: number }[]>,
    fetchQuery(api.pantry.pantry, {}, opts) as Promise<PantryRow[]>,
  ]);
  const reqDocs = await fetchRequirements(planRows.map((p) => p.recipeId));
  const pantry = buildPantryMap(pantryRows);
  const byId = new Map(reqDocs.map((d) => [d._id, d]));
  return planRows.map((p) => {
    const doc = byId.get(p.recipeId);
    const lines = doc?.lines ?? [];
    const metaFor = buildMetaFor(lines);
    const { requirements } = recipeRequirements(toRecipeLines(lines), p.scale, metaFor);
    return { recipeId: p.recipeId, scale: p.scale, coverage: recipeCoverage(requirements, pantry) };
  });
}
