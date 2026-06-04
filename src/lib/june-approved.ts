import type { RatingView } from "@/sanity/types";

export function isJuneApproved(
  ratings: RatingView[] | null | undefined,
): boolean {
  if (!ratings || ratings.length < 2) return false;
  return ratings.every((r) => typeof r.value === "number" && r.value >= 4.5);
}
