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
  /** Recipe ingredients excluding any marked optional — used for pantry coverage. */
  requiredIngredientIds?: string[] | null;
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

export type MacroSet = {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

export type RecipeMacros = {
  /** Per serving, required ingredients only. */
  base?: MacroSet;
  /** Per serving, including optional ingredients. */
  full?: MacroSet;
  estimated?: boolean;
  computedAt?: string;
  unparsedLines?: string[];
};

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
    | { _key: string; quantity?: string; unit?: string; note?: string; optional?: boolean; ingredientId: string; name: string | null }[]
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
  macros?: RecipeMacros | null;
};
