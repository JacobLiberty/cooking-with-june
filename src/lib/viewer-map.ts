import type { EditorRecord } from "@/lib/editor-allowlist";

export type Viewer = {
  isEditor: boolean;
  editorId: string | null;
  name: string | null;
};

// Bridge: a signed-in user is an "editor" iff a Sanity editor doc matched their email.
export function mapEditorToViewer(
  editor: EditorRecord | null,
  fallbackName: string | null,
): Viewer {
  return {
    isEditor: editor != null,
    editorId: editor?._id ?? null,
    name: editor?.name ?? fallbackName ?? null,
  };
}
