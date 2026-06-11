import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getMembership, requireMembership } from "./lib/auth";

function normalizeScale(scale: number): number {
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

async function planRow(
  ctx: MutationCtx,
  householdId: Id<"households">,
  recipeId: string,
) {
  return await ctx.db
    .query("planRecipes")
    .withIndex("by_household_recipe", (q) =>
      q.eq("householdId", householdId).eq("recipeId", recipeId),
    )
    .unique();
}

/** Insert or update the (household, recipe) plan row with a normalized scale. */
async function upsertScale(
  ctx: MutationCtx,
  householdId: Id<"households">,
  recipeId: string,
  scale: number,
) {
  const s = normalizeScale(scale);
  const existing = await planRow(ctx, householdId, recipeId);
  if (existing) {
    await ctx.db.patch(existing._id, { scale: s });
    return;
  }
  await ctx.db.insert("planRecipes", {
    householdId,
    recipeId,
    scale: s,
    addedAt: Date.now(),
  });
}

export const plan = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const m = await getMembership(ctx, userId);
    if (!m) return [];
    const rows = await ctx.db
      .query("planRecipes")
      .withIndex("by_household", (q) => q.eq("householdId", m.householdId))
      .collect();
    return rows.map((r) => ({
      recipeId: r.recipeId,
      scale: r.scale,
      addedAt: r.addedAt,
    }));
  },
});

export const addToPlan = mutation({
  args: { recipeId: v.string(), scale: v.number() },
  handler: async (ctx, { recipeId, scale }) => {
    const { householdId } = await requireMembership(ctx);
    await upsertScale(ctx, householdId, recipeId, scale);
  },
});

export const setScale = mutation({
  args: { recipeId: v.string(), scale: v.number() },
  handler: async (ctx, { recipeId, scale }) => {
    const { householdId } = await requireMembership(ctx);
    await upsertScale(ctx, householdId, recipeId, scale);
  },
});

export const removeFromPlan = mutation({
  args: { recipeId: v.string() },
  handler: async (ctx, { recipeId }) => {
    const { householdId } = await requireMembership(ctx);
    const existing = await planRow(ctx, householdId, recipeId);
    if (existing) await ctx.db.delete(existing._id);
  },
});
