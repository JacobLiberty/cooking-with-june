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

async function pantryRow(
  ctx: MutationCtx | QueryCtx,
  householdId: Id<"households">,
  ingredientId: string,
) {
  return await ctx.db
    .query("pantryItems")
    .withIndex("by_household_ingredient", (q) =>
      q.eq("householdId", householdId).eq("ingredientId", ingredientId),
    )
    .unique();
}

export const pantry = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const m = await getMembership(ctx, userId);
    if (!m) return [];
    const rows = await ctx.db
      .query("pantryItems")
      .withIndex("by_household", (q) => q.eq("householdId", m.householdId))
      .collect();
    return rows.map((r) => ({
      ingredientId: r.ingredientId,
      quantityG: r.quantityG,
      restockOverride: r.restockOverride ?? null,
      updatedAt: r.updatedAt,
    }));
  },
});

export const adjustPantry = mutation({
  args: { ingredientId: v.string(), deltaG: v.number() },
  handler: async (ctx, { ingredientId, deltaG }) => {
    if (!Number.isFinite(deltaG)) throw new Error("Invalid delta");
    const { householdId } = await requireMembership(ctx);
    const existing = await pantryRow(ctx, householdId, ingredientId);
    const next = Math.max(0, (existing?.quantityG ?? 0) + deltaG);
    if (existing) {
      await ctx.db.patch(existing._id, { quantityG: next, updatedAt: Date.now() });
      return;
    }
    await ctx.db.insert("pantryItems", {
      householdId,
      ingredientId,
      quantityG: next,
      updatedAt: Date.now(),
    });
  },
});

export const setPantryQuantity = mutation({
  args: { ingredientId: v.string(), quantityG: v.number() },
  handler: async (ctx, { ingredientId, quantityG }) => {
    if (!Number.isFinite(quantityG) || quantityG < 0) {
      throw new Error("Quantity must be a non-negative number");
    }
    const { householdId } = await requireMembership(ctx);
    const existing = await pantryRow(ctx, householdId, ingredientId);
    if (existing) {
      await ctx.db.patch(existing._id, { quantityG, updatedAt: Date.now() });
      return;
    }
    await ctx.db.insert("pantryItems", {
      householdId,
      ingredientId,
      quantityG,
      updatedAt: Date.now(),
    });
  },
});

export const setRestockOverride = mutation({
  args: {
    ingredientId: v.string(),
    restock: v.optional(v.object({ quantity: v.number(), unit: v.string() })),
  },
  handler: async (ctx, { ingredientId, restock }) => {
    if (restock && (!Number.isFinite(restock.quantity) || restock.quantity <= 0)) {
      throw new Error("Restock quantity must be positive");
    }
    const { householdId } = await requireMembership(ctx);
    const existing = await pantryRow(ctx, householdId, ingredientId);
    if (existing) {
      await ctx.db.patch(existing._id, {
        restockOverride: restock,
        updatedAt: Date.now(),
      });
      return;
    }
    await ctx.db.insert("pantryItems", {
      householdId,
      ingredientId,
      quantityG: 0,
      restockOverride: restock,
      updatedAt: Date.now(),
    });
  },
});
