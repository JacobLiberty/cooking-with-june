import type { RatingView } from "@/sanity/types";

export function averageRating(
  ratings: RatingView[] | null | undefined,
): number | null {
  if (!ratings || ratings.length === 0) return null;
  const values = ratings
    .map((r) => r.value)
    .filter((v): v is number => typeof v === "number");
  if (values.length === 0) return null;
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.round(avg * 2) / 2;
}
