"use server";

import { fetchMutation } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@cvx/_generated/api";
import { client } from "@/sanity/lib/client";
import { requireMember } from "@/lib/viewer";
import { importRecipeBlurb } from "@/lib/import/client";
import { validateImportResult } from "@/lib/import/validate";
import { buildDraft } from "@/lib/import/assemble";
import type { RecipeDraft } from "@/lib/import/types";

const reader = () => client.withConfig({ useCdn: false });

export type ImportRecipeResult =
  | { ok: true; draft: RecipeDraft }
  | { ok: false; error: string };

/**
 * Member-gated: rate-limit, normalize a blurb via Claude, resolve catalog
 * matches, and return a display-ready draft. No Sanity writes (publish is 4b).
 */
export async function importRecipe(blurb: string): Promise<ImportRecipeResult> {
  await requireMember();

  const clean = (blurb ?? "").trim();
  if (!clean) return { ok: false, error: "Paste a recipe to import." };

  // Rate limit (per-user/day). The day key is computed here (Date is fine in a
  // server action) and passed to the Convex mutation. Throws past the cap.
  const token = await convexAuthNextjsToken();
  const dayKey = new Date().toISOString().slice(0, 10);
  await fetchMutation(api.imports.recordImport, { dayKey }, token ? { token } : {});

  const raw = await importRecipeBlurb(clean);
  const validation = validateImportResult(raw);
  if (!validation.ok) {
    return { ok: false, error: "Couldn't read that recipe. Try adding more detail." };
  }

  // Resolve catalog ids by lower-cased name (parameterized GROQ).
  const names = [...new Set(validation.value.ingredients.map((i) => i.name.toLowerCase()))];
  const matches =
    names.length > 0
      ? ((await reader().fetch<{ _id: string; name: string }[]>(
          `*[_type == "ingredient" && lower(name) in $names]{ _id, name }`,
          { names },
        )) ?? [])
      : [];
  const catalogByName = new Map(matches.map((m) => [m.name.toLowerCase(), m._id]));

  return { ok: true, draft: buildDraft(validation.value, catalogByName) };
}
