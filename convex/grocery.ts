import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getMembership, requireMembership } from "./lib/auth";

async function groceryRow(
  ctx: MutationCtx | QueryCtx,
  householdId: Id<"households">,
  ingredientId: string,
) {
  return await ctx.db
    .query("groceryItems")
    .withIndex("by_household_ingredient", (q) =>
      q.eq("householdId", householdId).eq("ingredientId", ingredientId),
    )
    .unique();
}

export const grocery = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const m = await getMembership(ctx, userId);
    if (!m) return [];
    const rows = await ctx.db
      .query("groceryItems")
      .withIndex("by_household", (q) => q.eq("householdId", m.householdId))
      .collect();
    return rows.map((r) => ({
      ingredientId: r.ingredientId,
      source: r.source,
      manualQuantity: r.manualQuantity ?? null,
      buyQuantityG: r.buyQuantityG ?? null,
    }));
  },
});

async function writeRow(
  ctx: MutationCtx,
  ingredientId: string,
  source: "manual" | "skip",
  manualQuantity?: { quantity: number; unit: string },
) {
  const { householdId, userId } = await requireMembership(ctx);
  const existing = await groceryRow(ctx, householdId, ingredientId);
  if (existing) {
    await ctx.db.patch(existing._id, {
      source,
      manualQuantity,
      ...(source === "skip" ? { buyQuantityG: undefined } : {}),
    });
    return;
  }
  await ctx.db.insert("groceryItems", {
    householdId,
    ingredientId,
    source,
    manualQuantity,
    addedByUserId: userId,
    createdAt: Date.now(),
  });
}

export const addManualItem = mutation({
  args: {
    ingredientId: v.string(),
    manualQuantity: v.optional(
      v.object({ quantity: v.number(), unit: v.string() }),
    ),
  },
  handler: (ctx, { ingredientId, manualQuantity }) =>
    writeRow(ctx, ingredientId, "manual", manualQuantity),
});

export const setBuyQuantity = mutation({
  args: { ingredientId: v.string(), buyQuantityG: v.number() },
  handler: async (ctx, { ingredientId, buyQuantityG }) => {
    if (!Number.isInteger(buyQuantityG) || buyQuantityG <= 0) {
      throw new Error("Buy quantity must be a positive whole number");
    }
    const { householdId, userId } = await requireMembership(ctx);
    const existing = await groceryRow(ctx, householdId, ingredientId);
    if (existing) {
      await ctx.db.patch(existing._id, {
        // a manual row stays manual; skip/override rows become overrides
        source: existing.source === "manual" ? "manual" : "override",
        buyQuantityG,
      });
      return;
    }
    await ctx.db.insert("groceryItems", {
      householdId,
      ingredientId,
      source: "override",
      buyQuantityG,
      addedByUserId: userId,
      createdAt: Date.now(),
    });
  },
});

/** Delete the bought item's manual/override row (skips are not "bought"). */
export const removeBought = mutation({
  args: { ingredientId: v.string() },
  handler: async (ctx, { ingredientId }) => {
    const { householdId } = await requireMembership(ctx);
    const existing = await groceryRow(ctx, householdId, ingredientId);
    if (existing && existing.source !== "skip") await ctx.db.delete(existing._id);
  },
});

export const skip = mutation({
  args: { ingredientId: v.string() },
  handler: (ctx, { ingredientId }) => writeRow(ctx, ingredientId, "skip"),
});

async function deleteRowOfSource(
  ctx: MutationCtx,
  ingredientId: string,
  source: "manual" | "skip",
) {
  const { householdId } = await requireMembership(ctx);
  const existing = await groceryRow(ctx, householdId, ingredientId);
  if (existing && existing.source === source) await ctx.db.delete(existing._id);
}

export const removeManualItem = mutation({
  args: { ingredientId: v.string() },
  handler: (ctx, { ingredientId }) =>
    deleteRowOfSource(ctx, ingredientId, "manual"),
});

export const unskip = mutation({
  args: { ingredientId: v.string() },
  handler: (ctx, { ingredientId }) =>
    deleteRowOfSource(ctx, ingredientId, "skip"),
});

export const clearStale = mutation({
  args: { ingredientIds: v.array(v.string()) },
  handler: async (ctx, { ingredientIds }) => {
    const { householdId } = await requireMembership(ctx);
    for (const ingredientId of ingredientIds) {
      const existing = await groceryRow(ctx, householdId, ingredientId);
      if (existing && (existing.source === "skip" || existing.source === "override")) {
        await ctx.db.delete(existing._id);
      }
    }
  },
});
