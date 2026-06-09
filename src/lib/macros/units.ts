/**
 * Hand-maintained conversion tables for turning free-text ingredient amounts
 * into grams. These are deliberately approximate — good enough for "within ~20%
 * per serving" macro estimates, not nutrition-label accuracy.
 */

/** Mass units → grams (exact). */
export const MASS_G: Record<string, number> = {
  g: 1,
  gram: 1,
  kg: 1000,
  kilogram: 1000,
  mg: 0.001,
  oz: 28.35,
  ounce: 28.35,
  lb: 453.6,
  pound: 453.6,
};

/** Volume units → milliliters. Convert to grams via ingredient density. */
export const VOLUME_ML: Record<string, number> = {
  ml: 1,
  milliliter: 1,
  l: 1000,
  liter: 1000,
  litre: 1000,
  tsp: 4.93,
  teaspoon: 4.93,
  tbsp: 14.79,
  tablespoon: 14.79,
  cup: 240,
  pint: 473,
  quart: 946,
  "fl oz": 29.57,
};

/** Density (g/ml) for ingredients commonly measured by volume. Default 1 (water). */
export const DENSITY: Record<string, number> = {
  flour: 0.53,
  sugar: 0.85,
  "brown sugar": 0.9,
  oil: 0.92,
  butter: 0.96,
  honey: 1.42,
  syrup: 1.37,
  rice: 0.85,
  milk: 1.03,
  yogurt: 1.03,
  cream: 1.0,
  "soy sauce": 1.1,
  vinegar: 1.01,
  salt: 1.2,
  cheese: 0.6,
  breadcrumbs: 0.4,
  oats: 0.41,
};

/** Average weight (g) per countable item, keyed by ingredient or unit word. */
export const COUNT_WEIGHTS: Record<string, number> = {
  egg: 50,
  clove: 5,
  garlic: 5,
  onion: 110,
  shallot: 40,
  "green onion": 15,
  tomato: 120,
  "cherry tomato": 17,
  potato: 170,
  lemon: 60,
  lime: 67,
  orange: 130,
  pepper: 120,
  "bell pepper": 120,
  tortilla: 30,
  pita: 60,
  slice: 25,
  zucchini: 200,
  avocado: 150,
  cucumber: 300,
  "bay leaves": 0.2,
  "bay leaf": 0.2,
};

/** Units that denote a count of items rather than a measure. */
export const COUNT_UNITS = new Set([
  "",
  "clove",
  "cloves",
  "slice",
  "slices",
  "piece",
  "pieces",
  "whole",
  "can",
  "cans",
]);

/** Lowercase, trim, drop a trailing plural "s", and map a few aliases. */
export function normalizeUnit(unit: string | undefined | null): string {
  let u = (unit ?? "").trim().toLowerCase();
  if (!u) return "";
  const aliases: Record<string, string> = {
    tablespoons: "tbsp",
    tablespoon: "tbsp",
    teaspoons: "tsp",
    teaspoon: "tsp",
    grams: "g",
    gram: "g",
    kilograms: "kg",
    pounds: "lb",
    pound: "lb",
    lbs: "lb",
    ounces: "oz",
    ounce: "oz",
    cups: "cup",
    liters: "l",
    litre: "l",
    litres: "l",
    milliliters: "ml",
  };
  if (aliases[u]) return aliases[u];
  // generic singularization for table lookups (cloves → clove), but keep known
  // mass/volume keys intact.
  if (!(u in MASS_G) && !(u in VOLUME_ML) && u.endsWith("s")) {
    u = u.slice(0, -1);
  }
  return u;
}

// Match the most specific keyword first ("brown sugar" before "sugar").
const bySpecificity = (table: Record<string, number>) =>
  Object.keys(table).sort((a, b) => b.length - a.length);

/** Density for an ingredient name (most-specific matching keyword), default 1 g/ml. */
export function densityFor(name: string | null | undefined): number {
  const n = (name ?? "").toLowerCase();
  for (const key of bySpecificity(DENSITY)) {
    if (n.includes(key)) return DENSITY[key];
  }
  return 1;
}

/** Average item weight (g) for a count, by ingredient name or unit word; null if unknown. */
export function countWeightFor(
  name: string | null | undefined,
  unit: string,
): number | null {
  const n = (name ?? "").toLowerCase();
  for (const key of bySpecificity(COUNT_WEIGHTS)) {
    if (n.includes(key)) return COUNT_WEIGHTS[key];
  }
  if (unit && COUNT_WEIGHTS[unit] != null) return COUNT_WEIGHTS[unit];
  return null;
}
