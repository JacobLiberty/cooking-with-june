import { defineQuery } from "next-sanity";
import { client } from "@/sanity/lib/client";
import {
  findEditorByEmail,
  normalizeEmail,
  type EditorRecord,
} from "@/lib/editor-allowlist";

const EDITORS_QUERY = defineQuery(`
  *[_type == "editor" && defined(email)]{ _id, name, email }
`);

// Server-only: resolve the editor doc for a signed-in email, or null.
export async function getEditorByEmail(
  email: string | null | undefined,
): Promise<EditorRecord | null> {
  if (!normalizeEmail(email)) return null;
  const editors = await client
    .withConfig({ useCdn: false })
    .fetch<EditorRecord[]>(EDITORS_QUERY);
  return findEditorByEmail(editors, email);
}
