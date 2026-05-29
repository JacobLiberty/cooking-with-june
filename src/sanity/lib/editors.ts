import { defineQuery } from "next-sanity";
import { client } from "@/sanity/lib/client";
import { normalizeEmail, type EditorRecord } from "@/lib/editor-allowlist";

const EDITOR_BY_EMAIL_QUERY = defineQuery(
  `*[_type == "editor" && defined(email) && lower(email) == $email][0]{ _id, name }`,
);

// Server-only: resolve the editor doc for a signed-in email, or null.
export async function getEditorByEmail(
  email: string | null | undefined,
): Promise<EditorRecord | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const editor = await client
    .withConfig({ useCdn: false })
    .fetch<EditorRecord | null>(EDITOR_BY_EMAIL_QUERY, { email: normalized });
  return editor ?? null;
}
