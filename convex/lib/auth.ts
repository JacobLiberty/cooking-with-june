import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export async function requireUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  return userId;
}

export async function getMembership(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
) {
  return await ctx.db
    .query("memberships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

export async function requireMembership(ctx: QueryCtx | MutationCtx) {
  const userId = await requireUserId(ctx);
  const membership = await getMembership(ctx, userId);
  if (!membership) throw new Error("No household: complete setup first");
  return { userId, householdId: membership.householdId, role: membership.role };
}
