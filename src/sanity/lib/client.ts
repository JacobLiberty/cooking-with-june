import { createClient } from "next-sanity";
import { apiVersion, dataset, projectId } from "@/sanity/env";

export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  // Fresh reads (not the cached CDN edge) so edits, notes, and ratings show
  // up immediately after a write. This is a low-traffic personal app, so the
  // CDN's caching isn't worth the staleness it caused.
  useCdn: false,
});
