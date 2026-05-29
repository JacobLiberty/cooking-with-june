import type { RecipeCardData } from "@/sanity/types";
import { RecipeCard } from "@/components/recipe-card";

export function RecipeGrid({ recipes }: { recipes: RecipeCardData[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {recipes.map((r) => (
        <RecipeCard key={r._id} recipe={r} />
      ))}
    </div>
  );
}
