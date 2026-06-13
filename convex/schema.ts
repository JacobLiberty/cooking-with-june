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

  // Per-household made-it / to-try state over the shared (Sanity) recipes.
  recipeState: defineTable({
    householdId: v.id("households"),
    recipeId: v.string(),
    madeCount: v.number(),
    lastMadeAt: v.optional(v.number()),
    toTry: v.boolean(),
  })
    .index("by_household", ["householdId"])
    .index("by_household_recipe", ["householdId", "recipeId"]),

  // Per-household, author-attributed recipe notes.
  recipeNotes: defineTable({
    householdId: v.id("households"),
    recipeId: v.string(),
    userId: v.id("users"),
    author: v.optional(v.string()),
    text: v.string(),
  }).index("by_household_recipe", ["householdId", "recipeId"]),

  // Per-household planned recipes (recipeId is a Sanity _id string).
  planRecipes: defineTable({
    householdId: v.id("households"),
    recipeId: v.string(),
    scale: v.number(),
    addedAt: v.number(),
  })
    .index("by_household", ["householdId"])
    .index("by_household_recipe", ["householdId", "recipeId"]),

  // Per-household pantry stock. quantityG is the ingredient's canonical amount
  // (grams for mass/volume-kind, item count for count-kind).
  pantryItems: defineTable({
    householdId: v.id("households"),
    ingredientId: v.string(),
    quantityG: v.number(),
    // DEPRECATED (2026-06): no longer read or written; buy quantities live on
    // groceryItems.buyQuantityG. Kept so historical rows still validate.
    restockOverride: v.optional(
      v.object({ quantity: v.number(), unit: v.string() }),
    ),
    updatedAt: v.number(),
  })
    .index("by_household", ["householdId"])
    .index("by_household_ingredient", ["householdId", "ingredientId"]),

  // Per-household grocery rows: manual additions (+), skip suppressions (-),
  // and buy-quantity overrides for plan-derived needs. Plan-derived needs are
  // computed (not stored). buyQuantityG is the canonical whole-number amount
  // the shopper intends to buy (added to the pantry on check-off).
  groceryItems: defineTable({
    householdId: v.id("households"),
    ingredientId: v.string(),
    source: v.union(v.literal("manual"), v.literal("skip"), v.literal("override")),
    manualQuantity: v.optional(
      v.object({ quantity: v.number(), unit: v.string() }),
    ),
    buyQuantityG: v.optional(v.number()),
    addedByUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_household", ["householdId"])
    .index("by_household_ingredient", ["householdId", "ingredientId"]),

  importCounters: defineTable({
    userId: v.id("users"),
    dayKey: v.string(), // UTC YYYY-MM-DD, supplied by the caller
    count: v.number(),
  }).index("by_user_day", ["userId", "dayKey"]),
});
