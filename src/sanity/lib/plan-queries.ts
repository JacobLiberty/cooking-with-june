import { defineQuery } from "next-sanity";

export const PLAN_QUERY = defineQuery(`
  *[_id == "mealPlan"][0]{
    "recipes": recipes[]->{
      _id,
      title,
      "slug": slug.current,
      "coverImage": images[0],
      prepTime,
      cookTime,
      servings,
      "ingredients": ingredients[]{
        "ingredientId": ingredient._ref,
        "name": ingredient->name,
        quantity,
        unit
      }
    },
    manualItems[]{ _key, name, location },
    groceryIngredients,
    pantryIngredients
  }
`);

export const PLAN_RECIPE_IDS_QUERY = defineQuery(`
  *[_id == "mealPlan"][0].recipes[]._ref
`);
