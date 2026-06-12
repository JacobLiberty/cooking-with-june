import { recipe } from "./documents/recipe";
import { ingredient } from "./documents/ingredient";
import { tag } from "./documents/tag";
import { ingredientLine } from "./objects/ingredient-line";
import { macroSet } from "./objects/macro-set";

export const schemaTypes = [
  // documents
  recipe,
  ingredient,
  tag,
  // objects
  ingredientLine,
  macroSet,
];
