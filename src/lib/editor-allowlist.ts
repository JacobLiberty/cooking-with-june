export type EditorRecord = { _id: string; name: string };

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}
