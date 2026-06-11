import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Returns the current user's name + email (the only fields consumed by the
// header and the server-side editor bridge), or null when unauthenticated.
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return { name: user.name ?? null, email: user.email ?? null };
  },
});
