import { v } from "convex/values";
import {
  mutation,
  query,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getMembership, requireMembership } from "./lib/auth";

async function row(
  ctx: QueryCtx | MutationCtx,
  householdId: Id<"households">,
  recipeId: string,
) {
  return await ctx.db
    .query("recipeState")
    .withIndex("by_household_recipe", (q) =>
      q.eq("householdId", householdId).eq("recipeId", recipeId),
    )
    .unique();
}

const EMPTY = { madeCount: 0, lastMadeAt: null as number | null, toTry: false };

export const forRecipe = query({
  args: { recipeId: v.string() },
  handler: async (ctx, { recipeId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return EMPTY;
    const m = await getMembership(ctx, userId);
    if (!m) return EMPTY;
    const r = await row(ctx, m.householdId, recipeId);
    if (!r) return EMPTY;
    return {
      madeCount: r.madeCount,
      lastMadeAt: r.lastMadeAt ?? null,
      toTry: r.toTry,
    };
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const m = await getMembership(ctx, userId);
    if (!m) return [];
    const rows = await ctx.db
      .query("recipeState")
      .withIndex("by_household", (q) => q.eq("householdId", m.householdId))
      .collect();
    return rows.map((r) => ({
      recipeId: r.recipeId,
      madeCount: r.madeCount,
      toTry: r.toTry,
    }));
  },
});

type StatePatch = {
  madeCount?: number;
  lastMadeAt?: number;
  toTry?: boolean;
};

async function upsert(
  ctx: MutationCtx,
  recipeId: string,
  patch: (cur: { madeCount: number; toTry: boolean }) => StatePatch,
) {
  const { householdId } = await requireMembership(ctx);
  const existing = await row(ctx, householdId, recipeId);
  if (existing) {
    await ctx.db.patch(existing._id, patch(existing));
    return;
  }
  await ctx.db.insert("recipeState", {
    householdId,
    recipeId,
    madeCount: 0,
    toTry: false,
    ...patch({ madeCount: 0, toTry: false }),
  });
}

export const markMade = mutation({
  args: { recipeId: v.string(), at: v.number() },
  handler: (ctx, { recipeId, at }) => {
    if (!Number.isFinite(at) || at <= 0) throw new Error("Invalid timestamp");
    return upsert(ctx, recipeId, (cur) => ({
      madeCount: cur.madeCount + 1,
      lastMadeAt: at,
    }));
  },
});

export const unmarkMade = mutation({
  args: { recipeId: v.string() },
  handler: (ctx, { recipeId }) =>
    upsert(ctx, recipeId, (cur) => ({
      madeCount: Math.max(0, cur.madeCount - 1),
    })),
});

export const setToTry = mutation({
  args: { recipeId: v.string(), value: v.boolean() },
  handler: (ctx, { recipeId, value }) =>
    upsert(ctx, recipeId, () => ({ toTry: value })),
});
