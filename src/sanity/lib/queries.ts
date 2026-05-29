import { defineQuery } from "next-sanity";

export const RECIPES_QUERY = defineQuery(`
  *[_type == "recipe" && defined(slug.current)] | order(title asc){
    _id,
    title,
    "slug": slug.current,
    description,
    "coverImage": images[0],
    prepTime,
    cookTime,
    servings,
    wishlist,
    madeCount,
    "tags": tags[]->name,
    "ratings": ratings[]{ "editor": editor->name, value },
    "ingredientIds": ingredients[].ingredient._ref,
    "createdAt": _createdAt
  }
`);

export const RECIPE_QUERY = defineQuery(`
  *[_type == "recipe" && slug.current == $slug][0]{
    _id,
    title,
    "slug": slug.current,
    description,
    story,
    images,
    "ingredients": ingredients[]{ _key, quantity, unit, note, "name": ingredient->name },
    steps,
    prepTime,
    cookTime,
    servings,
    "tags": tags[]->name,
    "ratings": ratings[]{ _key, "editor": editor->name, value },
    wishlist,
    madeCount,
    lastMadeAt,
    "notes": notes[]{ _key, author, text }
  }
`);

export const INGREDIENTS_QUERY = defineQuery(`
  *[_type == "ingredient"] | order(name asc){ _id, name, category }
`);

export const TAGS_QUERY = defineQuery(`
  *[_type == "tag"] | order(name asc){ _id, name }
`);

export const RECIPE_SLUGS_QUERY = defineQuery(`
  *[_type == "recipe" && defined(slug.current)]{ "slug": slug.current }
`);
