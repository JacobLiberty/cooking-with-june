import { auth } from "@/auth";

export type Viewer = {
  isEditor: boolean;
  editorId: string | null;
  name: string | null;
};

export async function getViewer(): Promise<Viewer> {
  const session = await auth();
  return {
    isEditor: session?.user?.isEditor ?? false,
    editorId: session?.user?.editorId ?? null,
    name: session?.user?.name ?? null,
  };
}

/** Throws if the current request is not an authenticated editor. (Used in Phase 6.) */
export async function requireEditor(): Promise<Viewer & { editorId: string }> {
  const viewer = await getViewer();
  if (!viewer.isEditor || !viewer.editorId) {
    throw new Error("Not authorized: editors only");
  }
  return { ...viewer, editorId: viewer.editorId };
}
