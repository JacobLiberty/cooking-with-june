import { recipe } from "./documents/recipe";
import { ingredient } from "./documents/ingredient";
import { tag } from "./documents/tag";
import { mealPlan } from "./documents/meal-plan";
import { ingredientLine } from "./objects/ingredient-line";
import { manualGroceryItem } from "./objects/manual-item";
import { macroSet } from "./objects/macro-set";

export const schemaTypes = [
  // documents
  recipe,
  ingredient,
  tag,
  mealPlan,
  // objects
  ingredientLine,
  manualGroceryItem,
  macroSet,
];
