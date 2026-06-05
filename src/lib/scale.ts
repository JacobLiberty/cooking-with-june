/**
 * Scale a free-text ingredient quantity by a factor, preserving anything we
 * can't parse. Handles whole numbers, decimals, simple fractions ("1/2"),
 * mixed numbers ("1 1/2"), and ranges ("1-2"). Non-numeric quantities
 * ("a pinch", "to taste", "") are returned unchanged.
 */
export function scaleQuantity(
  quantity: string | undefined | null,
  factor: number,
): string {
  const q = (quantity ?? "").trim();
  if (!q || factor === 1) return q;

  // range "a-b" (also "a – b")
  const range = q.split(/\s*[-–]\s*/);
  if (range.length === 2) {
    const a = parseNum(range[0]);
    const b = parseNum(range[1]);
    if (a != null && b != null) return `${fmt(a * factor)}–${fmt(b * factor)}`;
  }

  const n = parseNum(q);
  if (n != null) return fmt(n * factor);
  return q;
}

/** Scale factor for a target serving count against the recipe's base. */
export function servingFactor(
  base: number | undefined | null,
  target: number,
): number {
  if (!base || base <= 0 || target <= 0) return 1;
  return target / base;
}

function parseNum(token: string): number | null {
  const t = token.trim();
  // mixed number "1 1/2"
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const [, whole, n, d] = mixed;
    return Number(whole) + Number(n) / Number(d);
  }
  // fraction "3/4"
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) {
    const [, n, d] = frac;
    return Number(d) === 0 ? null : Number(n) / Number(d);
  }
  // plain integer or decimal
  if (/^\d*\.?\d+$/.test(t)) return Number(t);
  return null;
}

function fmt(n: number): string {
  // round to 2 decimals, strip trailing zeros (2.00 → "2", 0.50 → "0.5")
  return String(Math.round(n * 100) / 100);
}
