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

const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 unambiguous chars
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // codes expire after 7 days

// Invite codes grant household access, so use a CSPRNG (Web Crypto) with
// rejection sampling to avoid modulo bias — not Math.random.
function makeCode(): string {
  const n = INVITE_ALPHABET.length;
  const limit = Math.floor(256 / n) * n; // reject bytes >= limit (248)
  const out: string[] = [];
  const buf = new Uint8Array(1);
  while (out.length < 8) {
    crypto.getRandomValues(buf);
    if (buf[0] >= limit) continue;
    out.push(INVITE_ALPHABET[buf[0] % n]);
  }
  return out.join("");
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
      expiresAt: Date.now() + INVITE_TTL_MS,
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
