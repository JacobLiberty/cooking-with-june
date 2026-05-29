export type EditorRecord = { _id: string; name: string; email: string };

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function findEditorByEmail(
  editors: EditorRecord[],
  email: string | null | undefined,
): EditorRecord | null {
  const target = normalizeEmail(email);
  if (!target) return null;
  return editors.find((e) => normalizeEmail(e.email) === target) ?? null;
}
