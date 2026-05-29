import type { SanityImageSource } from "@sanity/image-url";

export type RatingView = { editor: string | null; value: number };

export type RecipeCardData = {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  coverImage?: SanityImageSource | null;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  wishlist?: boolean;
  madeCount?: number;
  tags: string[] | null;
  ratings: RatingView[] | null;
  ingredientIds: string[] | null;
  createdAt: string;
};

export type IngredientOption = { _id: string; name: string; category?: string };
export type TagOption = { _id: string; name: string };

export type IngredientLineView = {
  _key: string;
  quantity?: string;
  unit?: string;
  note?: string;
  name: string | null;
};

export type RecipeNoteView = { _key: string; author?: string; text: string };

export type RecipeEditData = {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  story?: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  ingredients:
    | { _key: string; quantity?: string; unit?: string; note?: string; ingredientId: string; name: string | null }[]
    | null;
  steps: string[] | null;
  tagIds: string[] | null;
  hasImage: boolean;
};

export type RecipeDetailData = {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  story?: string;
  images?: SanityImageSource[];
  ingredients: IngredientLineView[] | null;
  steps: string[] | null;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  tags: string[] | null;
  ratings: (RatingView & { _key: string })[] | null;
  wishlist?: boolean;
  madeCount?: number;
  lastMadeAt?: string;
  notes: RecipeNoteView[] | null;
};
