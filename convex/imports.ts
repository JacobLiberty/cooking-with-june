import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireMembership } from "./lib/auth";

const DAILY_CAP = 25;

/**
 * Record one recipe import for the calling user on `dayKey` (UTC YYYY-MM-DD,
 * computed by the server action). Throws once the per-user daily cap is hit.
 */
export const recordImport = mutation({
  args: { dayKey: v.string() },
  handler: async (ctx, { dayKey }) => {
    const { userId } = await requireMembership(ctx);
    const existing = await ctx.db
      .query("importCounters")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).eq("dayKey", dayKey),
      )
      .first();
    const count = existing?.count ?? 0;
    if (count >= DAILY_CAP) {
      throw new Error("Daily import limit reached. Try again tomorrow.");
    }
    if (existing) {
      await ctx.db.patch(existing._id, { count: count + 1 });
    } else {
      await ctx.db.insert("importCounters", { userId, dayKey, count: 1 });
    }
  },
});
