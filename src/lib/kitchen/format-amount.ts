import type { CanonicalUnitKind } from "@/lib/enrichment/types";

export type DisplayKind = CanonicalUnitKind | null;

/** Round to a whole number (half up) — pantry amounts are always integers. */
export function roundForDisplay(n: number): number {
  return Math.round(n);
}

/**
 * Human display of a canonical pantry amount. Mass/volume kinds are stored in
 * grams; count kind is a (possibly fractional) item count shown bare.
 */
export function formatCanonicalAmount(quantity: number, kind: DisplayKind): string {
  const n = roundForDisplay(quantity);
  if (kind === "mass" || kind === "volume") return `${n} g`;
  return `${n}`;
}

/** The unit the user types into the adjust input for a given kind. */
export function canonicalUnitLabel(kind: DisplayKind): string {
  if (kind === "mass" || kind === "volume") return "g";
  if (kind === "count") return "ct";
  return "units";
}

/** How much a single −/+ nudge changes the canonical amount. */
export function pantryNudgeStep(kind: DisplayKind): number {
  return kind === "count" ? 1 : 10;
}
