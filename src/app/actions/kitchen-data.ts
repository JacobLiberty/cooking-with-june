"use server";

import { fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@cvx/_generated/api";
import { client } from "@/sanity/lib/client";
import { requireMember } from "@/lib/viewer";
import {
  RECIPE_REQUIREMENTS_QUERY,
  INGREDIENTS_BY_IDS_QUERY,
  MENU_RECIPES_QUERY,
  type RecipeRequirementDoc,
  type CatalogInfoDoc,
  type MenuRecipeDoc,
} from "@/sanity/lib/kitchen-queries";
import {
  buildMetaFor,
  buildPantryMap,
  toRecipeLines,
  toIngredientInfo,
  restockToCanonical,
  type RawLine,
} from "@/lib/kitchen/assemble";
import { resolveBuyQuantity } from "@/lib/kitchen/buy-quantity";
import { recipeRequirements } from "@/lib/kitchen/requirements";
import { computeNeeds } from "@/lib/kitchen/need";
import { recipeCoverage } from "@/lib/kitchen/cookable";
import type { IngredientRequirement } from "@/lib/kitchen/types";

const reader = () => client.withConfig({ useCdn: false });

/** CatalogInfoDoc → IngredientInfo (null when un-enriched). */
function catalogInfo(c: CatalogInfoDoc | undefined) {
  if (!c) return null;
  return toIngredientInfo({
    ingredientId: c._id,
    name: c.name,
    canonicalUnitKind: c.canonicalUnitKind,
    category: c.category,
    density: c.density,
    avgUnitGrams: c.avgUnitGrams,
  } as RawLine);
}

/** Catalog restock default in canonical units, or null. */
function restockCanonicalFor(c: CatalogInfoDoc | undefined): number | null {
  const info = catalogInfo(c);
  if (!c || !info) return null;
  return restockToCanonical(c.restockQuantity, info, c.name);
}

async function fetchRequirements(ids: string[]): Promise<RecipeRequirementDoc[]> {
  if (ids.length === 0) return [];
  return (await reader().fetch(RECIPE_REQUIREMENTS_QUERY, { ids })) ?? [];
}

async function catalogInfoByIds(ids: string[]): Promise<Map<string, CatalogInfoDoc>> {
  if (ids.length === 0) return new Map();
  const docs = (await reader().fetch<CatalogInfoDoc[]>(INGREDIENTS_BY_IDS_QUERY, { ids })) ?? [];
  return new Map(docs.map((d) => [d._id, d]));
}

type PantryRow = { ingredientId: string; quantityG: number; updatedAt: number };

export async function getPantryData() {
  await requireMember();
  const token = await convexAuthNextjsToken();
  const opts = token ? { token } : {};
  const [rows, groceryRows] = await Promise.all([
    fetchQuery(api.pantry.pantry, {}, opts) as Promise<PantryRow[]>,
    fetchQuery(api.grocery.grocery, {}, opts) as Promise<{ ingredientId: string; source: string }[]>,
  ]);
  const onList = new Set(
    groceryRows.filter((g) => g.source === "manual").map((g) => g.ingredientId),
  );
  const info = await catalogInfoByIds(rows.map((r) => r.ingredientId));
  return rows.map((r) => {
    const c = info.get(r.ingredientId);
    return {
      ingredientId: r.ingredientId,
      quantityG: r.quantityG,
      updatedAt: r.updatedAt,
      name: c?.name ?? r.ingredientId,
      canonicalUnitKind: c?.canonicalUnitKind ?? null,
      category: c?.category ?? null,
      onList: onList.has(r.ingredientId),
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
      {
        ingredientId: string;
        source: "manual" | "skip" | "override";
        manualQuantity: { quantity: number; unit: string } | null;
        buyQuantityG: number | null;
      }[]
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
  const needsRaw = computeNeeds(all, pantry).filter((n) => !skipSet.has(n.ingredientId));
  const manualRows = groceryRows.filter((g) => g.source === "manual");

  // One catalog lookup covers both need + manual ids (display category + unit kind).
  const info = await catalogInfoByIds([
    ...needsRaw.map((n) => n.ingredientId),
    ...manualRows.map((m) => m.ingredientId),
  ]);

  // Only `override` rows feed a need's buy quantity. A manual row's own
  // buyQuantityG is applied in the manual mapping below, not to needs.
  const overrideById = new Map(
    groceryRows
      .filter((g) => g.source === "override" && g.buyQuantityG != null)
      .map((g) => [g.ingredientId, g.buyQuantityG] as const),
  );

  const needs = needsRaw.map((n) => {
    const c = info.get(n.ingredientId);
    return {
      ...n,
      category: c?.category ?? null,
      canonicalUnitKind: c?.canonicalUnitKind ?? null,
      buyQuantityG: resolveBuyQuantity({
        override: overrideById.get(n.ingredientId) ?? null,
        restockCanonical: restockCanonicalFor(c),
        needAmount: n.amount,
        manualCanonical: null,
      }),
    };
  });
  const manual = manualRows.map((m) => {
    const c = info.get(m.ingredientId);
    const cInfo = catalogInfo(c);
    return {
      ingredientId: m.ingredientId,
      source: "manual" as const,
      manualQuantity: m.manualQuantity,
      name: c?.name ?? m.ingredientId,
      canonicalUnitKind: c?.canonicalUnitKind ?? null,
      category: c?.category ?? null,
      buyQuantityG: resolveBuyQuantity({
        override: m.buyQuantityG,
        restockCanonical: restockCanonicalFor(c),
        needAmount: null,
        manualCanonical:
          c && cInfo && m.manualQuantity
            ? restockToCanonical(m.manualQuantity, cInfo, c.name)
            : null,
      }),
    };
  });
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

export async function getPlannedRecipeIds(): Promise<string[]> {
  await requireMember();
  const token = await convexAuthNextjsToken();
  const rows = (await fetchQuery(api.plan.plan, {}, token ? { token } : {})) as {
    recipeId: string;
  }[];
  return rows.map((r) => r.recipeId);
}

export async function getMenuData() {
  const plan = await getPlanData();
  if (plan.length === 0) return [];
  const docs =
    (await reader().fetch<MenuRecipeDoc[]>(MENU_RECIPES_QUERY, {
      ids: plan.map((p) => p.recipeId),
    })) ?? [];
  const byId = new Map(docs.map((d) => [d._id, d]));
  return plan.map((p) => {
    const d = byId.get(p.recipeId);
    return {
      recipeId: p.recipeId,
      scale: p.scale,
      coverage: p.coverage,
      title: d?.title ?? "Untitled recipe",
      slug: d?.slug ?? null,
      coverImage: d?.coverImage ?? null,
      prepTime: d?.prepTime ?? null,
      cookTime: d?.cookTime ?? null,
      servings: d?.servings ?? null,
      optionalIngredients: (d?.optionalIngredients ?? []).map((o) => ({
        id: o.id,
        name: o.name ?? o.id,
      })),
    };
  });
}
