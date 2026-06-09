import { recipe } from "./documents/recipe";
import { ingredient } from "./documents/ingredient";
import { tag } from "./documents/tag";
import { editor } from "./documents/editor";
import { mealPlan } from "./documents/meal-plan";
import { ingredientLine } from "./objects/ingredient-line";
import { rating } from "./objects/rating";
import { recipeNote } from "./objects/recipe-note";
import { manualGroceryItem } from "./objects/manual-item";
import { macroSet } from "./objects/macro-set";

export const schemaTypes = [
  // documents
  recipe,
  ingredient,
  tag,
  editor,
  mealPlan,
  // objects
  ingredientLine,
  rating,
  recipeNote,
  manualGroceryItem,
  macroSet,
];
