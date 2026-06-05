import type { SanityImageSource } from "@sanity/image-url";
import type { PlanIngredient } from "@/lib/grocery";

export type PlanRecipe = {
  _id: string;
  title: string;
  slug: string;
  coverImage?: SanityImageSource | null;
  ingredients: PlanIngredient[] | null;
};

export type ManualItem = { _key: string; name: string; gotIt: boolean };

export type PlanData = {
  recipes: PlanRecipe[] | null;
  manualItems: ManualItem[] | null;
  checkedIngredients: string[] | null;
  removedIngredients: string[] | null;
};
