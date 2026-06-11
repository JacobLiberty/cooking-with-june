import { DENSITY, densityFor, countWeightFor } from "@/lib/macros/units";
import type { CanonicalUnitKind } from "@/lib/enrichment/types";

type FallbackHint = {
  canonicalUnitKind?: CanonicalUnitKind;
  density?: number;
  avgUnitGrams?: number;
};

/**
 * Best-effort metadata from the name-substring heuristics, used only to fill
 * gaps the model leaves. Returns nothing it can't infer (so unknown names get
 * an empty hint and rely on the model).
 */
export function fallbackMetadata(name: string): FallbackHint {
  // Empty unit: we have no unit context here, just the ingredient name.
  const countWeight = countWeightFor(name, "");
  if (countWeight != null) {
    return { canonicalUnitKind: "count", avgUnitGrams: countWeight };
  }
  // Check key presence (not `density !== 1`): an ingredient legitimately at
  // density 1.0 (e.g. cream) must still classify as volume-kind.
  const lower = name.toLowerCase();
  const hasDensity = Object.keys(DENSITY).some((k) => lower.includes(k));
  if (hasDensity) {
    return { canonicalUnitKind: "volume", density: densityFor(name) };
  }
  return {};
}

/** Fill only the fields missing from `result` using the heuristic fallback. */
export function mergeWithFallback<T extends FallbackHint>(result: T, name: string): T & FallbackHint {
  const fb = fallbackMetadata(name);
  return {
    ...result,
    canonicalUnitKind: result.canonicalUnitKind ?? fb.canonicalUnitKind,
    density: result.density ?? fb.density,
    avgUnitGrams: result.avgUnitGrams ?? fb.avgUnitGrams,
  };
}
