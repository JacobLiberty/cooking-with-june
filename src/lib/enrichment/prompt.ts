/**
 * Cached system rules + the structured-output tool schema for ingredient
 * enrichment. Kept pure (no SDK import) so it is unit-tested in isolation.
 */

import { CANONICAL_UNIT_KINDS, INGREDIENT_CATEGORIES } from "@/lib/enrichment/types";

/** The cached system block: classification rules + ground-truth examples. */
export function buildSystemRules(): string {
  return [
    "You assign kitchen stock metadata to grocery ingredients for a recipe app.",
    "For each ingredient choose:",
    "- canonicalUnitKind: 'mass' for things bought/measured by weight (ground beef, flour by weight),",
    "  'volume' for liquids and things measured by volume (milk, oil, soy sauce),",
    "  'count' for whole items (eggs, lemons, garlic cloves).",
    "- density (g/ml): ONLY for volume-kind. Examples: water 1.0, flour 0.53, sugar 0.85,",
    "  oil 0.92, honey 1.42, milk 1.03. Match these where applicable.",
    "- avgUnitGrams: ONLY for count-kind. Examples: egg 50, garlic clove 5, onion 110,",
    "  lemon 60, tomato 120.",
    "- restockQuantity { quantity, unit }: ONE typical grocery purchase. Examples:",
    "  eggs -> { quantity: 12, unit: '' }, flour -> { quantity: 5, unit: 'lb' },",
    "  milk -> { quantity: 1, unit: 'l' }. Use '' for unit on pure counts.",
    `- category: one of ${INGREDIENT_CATEGORIES.join(", ")}. Use 'nonfood' for paper towels,`,
    "  foil, dish soap, etc. Non-food items are excluded from the cookable filter.",
    "Be consistent with the example values above.",
  ].join("\n");
}

export function buildUserPrompt(names: string[]): string {
  return [
    "Assign stock metadata to these ingredients. Return one entry per name:",
    ...names.map((n) => `- ${n}`),
  ].join("\n");
}

/**
 * The inner schema shape we navigate in tests and at runtime.
 * Kept as a plain object (not typed against Anthropic.Tool) so this module
 * stays SDK-free and purely testable. The client casts it on use.
 */
export const ENRICHMENT_TOOL = {
  name: "assign_stock_metadata",
  description: "Return stock metadata for each ingredient name.",
  input_schema: {
    type: "object" as const,
    properties: {
      items: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            name: { type: "string" as const },
            canonicalUnitKind: { type: "string" as const, enum: [...CANONICAL_UNIT_KINDS] },
            density: { type: "number" as const },
            avgUnitGrams: { type: "number" as const },
            restockQuantity: {
              type: "object" as const,
              properties: {
                quantity: { type: "number" as const },
                unit: { type: "string" as const },
              },
              required: ["quantity", "unit"],
            },
            category: { type: "string" as const, enum: [...INGREDIENT_CATEGORIES] },
          },
          required: ["name", "canonicalUnitKind", "restockQuantity", "category"],
        },
      },
    },
    required: ["items"],
  },
};
