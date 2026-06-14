import { getWriteClient } from "@/sanity/lib/write-client";

// The deployed Sanity schema id (from `sanity schema list`).
const SCHEMA_ID = "_.schemas.default";

/** Cozy editorial cover prompt in the app's terracotta/cream house style. */
export function coverInstruction(title: string): string {
  return [
    `Generate a cover photo for the recipe "${title}".`,
    "Style: cozy, appetizing, editorial home-cookbook food photography,",
    "warm natural light, earthy terracotta and cream tones, shallow depth of field.",
    "No text or words in the image.",
  ].join(" ");
}

/**
 * Fire-and-forget cover generation via Sanity Agent Actions (experimental). The
 * image arrives asynchronously on the document. Best-effort: any failure is
 * logged but never blocks publishing (the member can upload or regenerate).
 */
export async function generateRecipeCover(documentId: string, title: string): Promise<void> {
  try {
    await getWriteClient()
      // Agent Actions live on Sanity's experimental channel — they require the
      // `vX` API version, not the app's dated default, or the request 404s.
      .withConfig({ apiVersion: "vX" })
      .agent.action.generate({
        documentId,
        schemaId: SCHEMA_ID,
        instruction: coverInstruction(title),
        // `images` is an array of image; target the array so Generate appends a
        // new item. Targeting `["images", "asset"]` is invalid for an array.
        target: { path: ["images"] },
        // Recipes are published directly (no draft workflow). Without this, the
        // cover would land on a draft and never appear on the live recipe.
        forcePublishedWrite: true,
      });
  } catch (err) {
    // Best-effort: never block publishing, but log so the failure isn't silent.
    console.error("Recipe cover generation failed", err);
  }
}
