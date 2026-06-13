export type BuyQuantityInputs = {
  /** Stored groceryItems.buyQuantityG (already a positive integer). */
  override: number | null;
  /** Catalog restock default converted to canonical units. */
  restockCanonical: number | null;
  /** Computed plan need in canonical units (need items only). */
  needAmount: number | null;
  /** Manual row's quantity converted to canonical units (manual items only). */
  manualCanonical: number | null;
};

/**
 * The whole-number canonical amount a shopper will buy — and exactly what gets
 * added to the pantry on check-off. Resolution order: explicit override →
 * restock default → needed amount → manual quantity. Null when nothing is
 * resolvable (the row then checks off without a pantry write).
 */
export function resolveBuyQuantity(i: BuyQuantityInputs): number | null {
  for (const candidate of [i.override, i.restockCanonical, i.needAmount, i.manualCanonical]) {
    if (candidate != null && Number.isFinite(candidate) && candidate > 0) {
      return Math.max(1, Math.ceil(candidate));
    }
  }
  return null;
}
