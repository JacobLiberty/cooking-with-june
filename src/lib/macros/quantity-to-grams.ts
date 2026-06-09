import { parseQuantityValue } from "@/lib/scale";
import {
  MASS_G,
  VOLUME_ML,
  COUNT_UNITS,
  normalizeUnit,
  densityFor,
  countWeightFor,
} from "@/lib/macros/units";

export type GramsResult =
  | { grams: number }
  | { unparseable: true; reason: string };

/**
 * Convert one ingredient line (free-text quantity + unit + name) to grams.
 *
 * - Mass units are exact.
 * - Volume units use an ingredient density (default water).
 * - Unitless/count amounts use an average item weight, when known.
 * - Anything without a number, or a count we don't have a weight for, is
 *   reported unparseable so the caller can skip and flag it.
 */
export function quantityToGrams(
  quantity: string | undefined | null,
  unit: string | undefined | null,
  name: string | null | undefined,
): GramsResult {
  const value = parseQuantityValue(quantity);
  if (value == null) {
    return { unparseable: true, reason: "no numeric quantity" };
  }
  if (value < 0) {
    return { unparseable: true, reason: "negative quantity" };
  }

  const u = normalizeUnit(unit);

  if (u in MASS_G) {
    return { grams: value * MASS_G[u] };
  }

  if (u in VOLUME_ML) {
    return { grams: value * VOLUME_ML[u] * densityFor(name) };
  }

  if (COUNT_UNITS.has(u)) {
    const weight = countWeightFor(name, u);
    if (weight == null) {
      return { unparseable: true, reason: `no item weight for "${name ?? ""}"` };
    }
    return { grams: value * weight };
  }

  return { unparseable: true, reason: `unknown unit "${unit ?? ""}"` };
}
