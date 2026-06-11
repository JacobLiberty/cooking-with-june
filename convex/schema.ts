import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// authTables provides users, authSessions, authAccounts, etc.
// Spec 2 adds pantry/grocery/plan.
export default defineSchema({
  ...authTables,

  households: defineTable({
    name: v.string(),
    ownerUserId: v.id("users"),
  }).index("by_owner", ["ownerUserId"]),

  memberships: defineTable({
    userId: v.id("users"),
    householdId: v.id("households"),
    role: v.union(v.literal("owner"), v.literal("member")),
  })
    .index("by_user", ["userId"])
    .index("by_household", ["householdId"]),

  invites: defineTable({
    householdId: v.id("households"),
    code: v.string(),
    createdByUserId: v.id("users"),
    expiresAt: v.optional(v.number()),
    usedByUserId: v.optional(v.id("users")),
  }).index("by_code", ["code"]),

  // Global per-user recipe ratings (recipeId is a Sanity _id string).
  ratings: defineTable({
    recipeId: v.string(),
    userId: v.id("users"),
    value: v.number(),
  })
    .index("by_recipe", ["recipeId"])
    .index("by_recipe_user", ["recipeId", "userId"]),
});
