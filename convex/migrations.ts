import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * One-time: import existing Sanity ratings into Convex, keyed by the rater's
 * Convex user id (resolved from their email). Run AFTER the raters have signed
 * in at least once (so their `users` rows exist):
 *
 *   npx convex run migrations:importRatings '{"rows": [ {recipeId, email, value}, ... ]}'
 *
 * Export the rows from Sanity Vision with:
 *   *[_type=="recipe" && defined(ratings)]{
 *     "recipeId": _id, "ratings": ratings[]{ "email": editor->email, value }
 *   }
 * then flatten to one {recipeId, email, value} per rating.
 */
export const importRatings = internalMutation({
  args: {
    rows: v.array(
      v.object({
        recipeId: v.string(),
        email: v.string(),
        value: v.number(),
      }),
    ),
  },
  handler: async (ctx, { rows }) => {
    let imported = 0;
    let skipped = 0;
    for (const row of rows) {
      const email = row.email.trim().toLowerCase();
      const user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .unique();
      if (!user) {
        skipped++; // rater hasn't signed in yet
        continue;
      }
      const existing = await ctx.db
        .query("ratings")
        .withIndex("by_recipe_user", (q) =>
          q.eq("recipeId", row.recipeId).eq("userId", user._id),
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, { value: row.value });
      } else {
        await ctx.db.insert("ratings", {
          recipeId: row.recipeId,
          userId: user._id,
          value: row.value,
        });
      }
      imported++;
    }
    return { imported, skipped };
  },
});
