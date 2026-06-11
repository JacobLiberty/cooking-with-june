import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getMembership, requireUserId, requireMembership } from "./lib/auth";

// Current user's identity + household context, or null when unauthenticated.
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    const membership = await getMembership(ctx, userId);
    return {
      userId,
      name: user?.name ?? null,
      householdId: membership?.householdId ?? null,
      role: membership?.role ?? null,
    };
  },
});

export const createHousehold = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await requireUserId(ctx);
    const existing = await getMembership(ctx, userId);
    if (existing) throw new Error("You already belong to a household");
    const clean = name.trim();
    if (!clean) throw new Error("Household name is required");
    const householdId = await ctx.db.insert("households", {
      name: clean,
      ownerUserId: userId,
    });
    await ctx.db.insert("memberships", { userId, householdId, role: "owner" });
    return householdId;
  },
});

function makeCode(): string {
  // 8 chars, unambiguous alphabet. Math.random is allowed in Convex mutations.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export const createInvite = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId, householdId, role } = await requireMembership(ctx);
    if (role !== "owner") throw new Error("Only the owner can invite");
    const code = makeCode();
    await ctx.db.insert("invites", {
      householdId,
      code,
      createdByUserId: userId,
    });
    return code;
  },
});

export const acceptInvite = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await requireUserId(ctx);
    if (await getMembership(ctx, userId)) {
      throw new Error("You already belong to a household");
    }
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_code", (q) => q.eq("code", code.trim().toUpperCase()))
      .unique();
    if (!invite) throw new Error("Invalid invite code");
    if (invite.usedByUserId) throw new Error("Invite code already used");
    if (invite.expiresAt && invite.expiresAt < Date.now()) {
      throw new Error("Invite code expired");
    }
    await ctx.db.insert("memberships", {
      userId,
      householdId: invite.householdId,
      role: "member",
    });
    await ctx.db.patch(invite._id, { usedByUserId: userId });
    return invite.householdId;
  },
});

export const leaveHousehold = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId, role } = await requireMembership(ctx);
    if (role === "owner") {
      throw new Error("The owner cannot leave; transfer or delete the household");
    }
    const membership = await getMembership(ctx, userId);
    if (membership) await ctx.db.delete(membership._id);
  },
});
