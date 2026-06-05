import type { SanityImageSource } from "@sanity/image-url";
import type { PlanIngredient } from "@/lib/grocery";

export type PlanRecipe = {
  _id: string;
  title: string;
  slug: string;
  coverImage?: SanityImageSource | null;
  prepTime?: number | null;
  cookTime?: number | null;
  servings?: number | null;
  ingredients: PlanIngredient[] | null;
};

export type ManualLocation = "grocery" | "pantry";

export type ManualItem = {
  _key: string;
  name: string;
  location: ManualLocation | null;
};

export type PlanData = {
  recipes: PlanRecipe[] | null;
  manualItems: ManualItem[] | null;
  groceryIngredients: string[] | null;
  pantryIngredients: string[] | null;
};
