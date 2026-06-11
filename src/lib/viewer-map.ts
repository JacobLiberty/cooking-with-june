export type ViewerRecord = {
  userId: string;
  name: string | null;
  householdId: string | null;
  role: "owner" | "member" | null;
};

export type Viewer = {
  isAuthenticated: boolean;
  isMember: boolean;
  userId: string | null;
  householdId: string | null;
  role: "owner" | "member" | null;
  name: string | null;
};

export const ANON_VIEWER: Viewer = {
  isAuthenticated: false,
  isMember: false,
  userId: null,
  householdId: null,
  role: null,
  name: null,
};

// A signed-in user is a "member" once they belong to a household.
export function mapViewer(record: ViewerRecord | null): Viewer {
  if (!record) return ANON_VIEWER;
  return {
    isAuthenticated: true,
    isMember: record.householdId != null,
    userId: record.userId,
    householdId: record.householdId,
    role: record.role,
    name: record.name,
  };
}
