export function formatMinutes(min: number | null | undefined): string | null {
  if (min == null || min <= 0) return null;
  const hours = Math.floor(min / 60);
  const mins = min % 60;
  if (hours && mins) return `${hours} hr ${mins} min`;
  if (hours) return `${hours} hr`;
  return `${mins} min`;
}

export function totalTime(
  prep: number | null | undefined,
  cook: number | null | undefined,
): string | null {
  return formatMinutes((prep ?? 0) + (cook ?? 0));
}
