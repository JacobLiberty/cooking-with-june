import { v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireMembership } from "./lib/auth";

async function depleteOne(
  ctx: MutationCtx,
  householdId: Id<"households">,
  ingredientId: string,
  subtract: number,
) {
  const existing = await ctx.db
    .query("pantryItems")
    .withIndex("by_household_ingredient", (q) =>
      q.eq("householdId", householdId).eq("ingredientId", ingredientId),
    )
    .unique();
  const next = Math.max(0, (existing?.quantityG ?? 0) - subtract);
  if (existing) {
    await ctx.db.patch(existing._id, { quantityG: next, updatedAt: Date.now() });
  } else {
    await ctx.db.insert("pantryItems", {
      householdId,
      ingredientId,
      quantityG: next,
      updatedAt: Date.now(),
    });
  }
}

async function recordMade(
  ctx: MutationCtx,
  householdId: Id<"households">,
  recipeId: string,
  at: number,
) {
  const existing = await ctx.db
    .query("recipeState")
    .withIndex("by_household_recipe", (q) =>
      q.eq("householdId", householdId).eq("recipeId", recipeId),
    )
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, {
      madeCount: existing.madeCount + 1,
      lastMadeAt: at,
    });
  } else {
    await ctx.db.insert("recipeState", {
      householdId,
      recipeId,
      madeCount: 1,
      lastMadeAt: at,
      toTry: false,
    });
  }
}

export const cook = mutation({
  args: {
    recipeId: v.string(),
    at: v.number(),
    deltas: v.array(v.object({ ingredientId: v.string(), subtract: v.number() })),
  },
  handler: async (ctx, { recipeId, at, deltas }) => {
    if (!Number.isFinite(at) || at <= 0) throw new Error("Invalid timestamp");
    const { householdId } = await requireMembership(ctx);

    for (const d of deltas) {
      if (!Number.isFinite(d.subtract) || d.subtract < 0) continue;
      await depleteOne(ctx, householdId, d.ingredientId, d.subtract);
    }

    await recordMade(ctx, householdId, recipeId, at);

    const planned = await ctx.db
      .query("planRecipes")
      .withIndex("by_household_recipe", (q) =>
        q.eq("householdId", householdId).eq("recipeId", recipeId),
      )
      .unique();
    if (planned) await ctx.db.delete(planned._id);
  },
});
