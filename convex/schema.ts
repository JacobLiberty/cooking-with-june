import { defineSchema } from "convex/server";
import { authTables } from "@convex-dev/auth/server";

// authTables provides users, authSessions, authAccounts, etc.
// Spec 1b adds households/memberships/invites; Spec 2 adds pantry/grocery/plan.
export default defineSchema({
  ...authTables,
});
