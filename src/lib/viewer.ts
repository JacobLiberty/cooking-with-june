import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@cvx/_generated/api";
import { mapViewer, ANON_VIEWER, type Viewer } from "@/lib/viewer-map";

export type { Viewer };

// Server-only: resolve the current viewer from the Convex membership record.
export async function getViewer(): Promise<Viewer> {
  const token = await convexAuthNextjsToken();
  if (!token) return ANON_VIEWER;
  const record = await fetchQuery(api.households.viewer, {}, { token });
  return mapViewer(record);
}

// Throws unless the request is an authenticated household member.
export async function requireMember(): Promise<{
  userId: string;
  householdId: string;
}> {
  const viewer = await getViewer();
  if (!viewer.isMember || !viewer.userId || !viewer.householdId) {
    throw new Error("Not authorized: household members only");
  }
  return { userId: viewer.userId, householdId: viewer.householdId };
}
