import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@cvx/_generated/api";
import { getEditorByEmail } from "@/sanity/lib/editors";
import { mapEditorToViewer, type Viewer } from "@/lib/viewer-map";

export type { Viewer };

const ANON: Viewer = { isEditor: false, editorId: null, name: null };

// Server-only: resolve the current viewer. Auth identity comes from Convex;
// "editor" status is bridged to the existing Sanity editor allowlist by email.
export async function getViewer(): Promise<Viewer> {
  const token = await convexAuthNextjsToken();
  if (!token) return ANON;

  const me = await fetchQuery(api.users.me, {}, { token });
  const email = me?.email ?? null;
  if (!email) return { ...ANON, name: me?.name ?? null };

  const editor = await getEditorByEmail(email);
  return mapEditorToViewer(editor, me?.name ?? null);
}

// Throws if the current request is not an authenticated editor.
export async function requireEditor(): Promise<Viewer & { editorId: string }> {
  const viewer = await getViewer();
  if (!viewer.isEditor || !viewer.editorId) {
    throw new Error("Not authorized: editors only");
  }
  return { ...viewer, editorId: viewer.editorId };
}
