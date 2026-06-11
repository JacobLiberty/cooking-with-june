// Round a raw rating average to the nearest half-star for display. Kept separate
// from the stored/sorted value so ranking uses the precise average, not the
// coarsened one.
export function roundHalf(n: number | null | undefined): number | null {
  if (n == null) return null;
  return Math.round(n * 2) / 2;
}
