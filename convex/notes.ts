import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getMembership, requireMembership } from "./lib/auth";

export const forRecipe = query({
  args: { recipeId: v.string() },
  handler: async (ctx, { recipeId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const m = await getMembership(ctx, userId);
    if (!m) return [];
    const rows = await ctx.db
      .query("recipeNotes")
      .withIndex("by_household_recipe", (q) =>
        q.eq("householdId", m.householdId).eq("recipeId", recipeId),
      )
      .collect(); // index order = insertion order (oldest first)
    return rows.map((r) => ({ _id: r._id, author: r.author ?? null, text: r.text }));
  },
});

export const add = mutation({
  args: { recipeId: v.string(), text: v.string() },
  handler: async (ctx, { recipeId, text }) => {
    const { userId, householdId } = await requireMembership(ctx);
    const clean = text.trim();
    if (!clean) throw new Error("Note is empty");
    if (clean.length > 500) throw new Error("Note too long (max 500)");
    const user = await ctx.db.get(userId);
    await ctx.db.insert("recipeNotes", {
      householdId,
      recipeId,
      userId,
      author: user?.name ?? undefined,
      text: clean,
    });
  },
});

export const remove = mutation({
  args: { noteId: v.id("recipeNotes") },
  handler: async (ctx, { noteId }) => {
    const { householdId } = await requireMembership(ctx);
    const note = await ctx.db.get(noteId);
    if (!note || note.householdId !== householdId) {
      throw new Error("Note not found");
    }
    await ctx.db.delete(noteId);
  },
});
