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
 * swallowed so it never blocks publishing (the member can upload or regenerate).
 */
export async function generateRecipeCover(documentId: string, title: string): Promise<void> {
  try {
    await getWriteClient().agent.action.generate({
      documentId,
      schemaId: SCHEMA_ID,
      instruction: coverInstruction(title),
      target: { path: ["images", "asset"] },
    });
  } catch {
    // experimental API hiccup — leave the recipe coverless; it can be added later
  }
}
