import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireMembership } from "./lib/auth";

export const forRecipe = query({
  args: { recipeId: v.string() },
  handler: async (ctx, { recipeId }) => {
    const rows = await ctx.db
      .query("ratings")
      .withIndex("by_recipe", (q) => q.eq("recipeId", recipeId))
      .collect();
    const count = rows.length;
    const average =
      count === 0 ? 0 : rows.reduce((s, r) => s + r.value, 0) / count;
    const approved = count >= 2 && rows.every((r) => r.value >= 4.5);

    const userId = await getAuthUserId(ctx);
    const mine = userId
      ? (rows.find((r) => r.userId === userId)?.value ?? null)
      : null;

    return { average, count, mine, approved };
  },
});

export const forRecipes = query({
  args: { recipeIds: v.array(v.string()) },
  handler: async (ctx, { recipeIds }) => {
    const out: Record<
      string,
      { average: number; count: number; approved: boolean }
    > = {};
    for (const recipeId of recipeIds) {
      const rows = await ctx.db
        .query("ratings")
        .withIndex("by_recipe", (q) => q.eq("recipeId", recipeId))
        .collect();
      const count = rows.length;
      out[recipeId] = {
        count,
        average: count === 0 ? 0 : rows.reduce((s, r) => s + r.value, 0) / count,
        approved: count >= 2 && rows.every((r) => r.value >= 4.5),
      };
    }
    return out;
  },
});

export const rate = mutation({
  args: { recipeId: v.string(), value: v.number() },
  handler: async (ctx, { recipeId, value }) => {
    const { userId } = await requireMembership(ctx);
    if (typeof value !== "number" || value < 0 || value > 5) {
      throw new Error("Rating must be 0–5");
    }
    const existing = await ctx.db
      .query("ratings")
      .withIndex("by_recipe_user", (q) =>
        q.eq("recipeId", recipeId).eq("userId", userId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { value });
    } else {
      await ctx.db.insert("ratings", { recipeId, userId, value });
    }
  },
});
