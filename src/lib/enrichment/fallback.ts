import { densityFor, countWeightFor } from "@/lib/macros/units";
import type { CanonicalUnitKind } from "@/lib/enrichment/types";

type Partial2 = {
  canonicalUnitKind?: CanonicalUnitKind;
  density?: number;
  avgUnitGrams?: number;
};

/**
 * Best-effort metadata from the name-substring heuristics, used only to fill
 * gaps the model leaves. Returns nothing it can't infer (so unknown names get
 * an empty hint and rely on the model).
 */
export function fallbackMetadata(name: string): Partial2 {
  const countWeight = countWeightFor(name, "");
  if (countWeight != null) {
    return { canonicalUnitKind: "count", avgUnitGrams: countWeight };
  }
  const density = densityFor(name);
  if (density !== 1) {
    return { canonicalUnitKind: "volume", density };
  }
  return {};
}

/** Fill only the fields missing from `result` using the heuristic fallback. */
export function mergeWithFallback<T extends Partial2>(result: T, name: string): T & Partial2 {
  const fb = fallbackMetadata(name);
  return {
    ...result,
    canonicalUnitKind: result.canonicalUnitKind ?? fb.canonicalUnitKind,
    density: result.density ?? fb.density,
    avgUnitGrams: result.avgUnitGrams ?? fb.avgUnitGrams,
  };
}
