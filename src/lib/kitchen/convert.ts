import { parseQuantityValue } from "@/lib/scale";
import {
  MASS_G,
  VOLUME_ML,
  COUNT_UNITS,
  normalizeUnit,
  densityFor,
  countWeightFor,
} from "@/lib/macros/units";
import type { ConversionMeta, GramsResult } from "@/lib/kitchen/types";

/**
 * Convert one ingredient line to grams, preferring the ingredient's stored
 * metadata (density / avgUnitGrams) over the name-substring heuristics.
 *
 * - Mass units are exact.
 * - Volume units use `meta.density`, else the name heuristic (default water).
 * - Count/unitless amounts use `meta.avgUnitGrams`, else the name heuristic.
 * Anything without a number, an unknown unit, or a count with no known weight is
 * reported unparseable so the caller can flag it.
 */
export function lineToGrams(
  quantity: string | undefined | null,
  unit: string | undefined | null,
  meta: ConversionMeta,
  name: string,
): GramsResult {
  const value = parseQuantityValue(quantity);
  if (value == null) return { unparseable: true, reason: "no numeric quantity" };
  if (value < 0) return { unparseable: true, reason: "negative quantity" };

  const u = normalizeUnit(unit);

  if (u in MASS_G) return { grams: value * MASS_G[u] };

  if (u in VOLUME_ML) {
    const density = meta.density ?? densityFor(name);
    return { grams: value * VOLUME_ML[u] * density };
  }

  if (COUNT_UNITS.has(u)) {
    const weight = meta.avgUnitGrams ?? countWeightFor(name, u);
    if (weight == null) {
      return { unparseable: true, reason: `no item weight for "${name}"` };
    }
    return { grams: value * weight };
  }

  return { unparseable: true, reason: `unknown unit "${unit ?? ""}"` };
}

export type CanonicalResult =
  | { ok: true; amount: number }
  | { ok: false; reason: string };

/**
 * Convert a line to the ingredient's canonical unit: grams for mass/volume-kind,
 * item count for count-kind. Count conversion divides grams by the per-item
 * weight (stored `avgUnitGrams`, else the name heuristic).
 */
export function lineToCanonical(
  quantity: string | undefined | null,
  unit: string | undefined | null,
  meta: ConversionMeta,
  name: string,
): CanonicalResult {
  const g = lineToGrams(quantity, unit, meta, name);
  if ("unparseable" in g) return { ok: false, reason: g.reason };

  if (meta.canonicalUnitKind === "count") {
    const per = meta.avgUnitGrams ?? countWeightFor(name, "") ?? null;
    if (per == null || per <= 0) {
      return { ok: false, reason: `no per-item weight for "${name}"` };
    }
    return { ok: true, amount: g.grams / per };
  }

  return { ok: true, amount: g.grams };
}
