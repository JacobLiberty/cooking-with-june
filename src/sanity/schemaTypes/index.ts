import { recipe } from "./documents/recipe";
import { ingredient } from "./documents/ingredient";
import { tag } from "./documents/tag";
import { editor } from "./documents/editor";
import { ingredientLine } from "./objects/ingredient-line";
import { rating } from "./objects/rating";
import { recipeNote } from "./objects/recipe-note";

export const schemaTypes = [
  // documents
  recipe,
  ingredient,
  tag,
  editor,
  // objects
  ingredientLine,
  rating,
  recipeNote,
];
