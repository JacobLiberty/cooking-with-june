import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { client } from "@/sanity/lib/client";
import { PLAN_QUERY } from "@/sanity/lib/plan-queries";
import { INGREDIENTS_QUERY } from "@/sanity/lib/queries";
import type { PlanData } from "@/sanity/plan-types";
import type { IngredientOption } from "@/sanity/types";
import { PlanView } from "@/components/plan-view";
import { InvitePanel } from "@/components/invite-panel";

export default async function PlanPage() {
  const viewer = await getViewer();
  if (!viewer.isAuthenticated) redirect("/");
  if (!viewer.isMember) redirect("/household/setup");

  const fresh = client.withConfig({ useCdn: false });
  const [plan, ingredients] = await Promise.all([
    fresh.fetch<PlanData | null>(PLAN_QUERY),
    fresh.fetch<IngredientOption[]>(INGREDIENTS_QUERY),
  ]);

  return (
    <section className="mx-auto max-w-2xl">
      <header className="set set-1">
        <p className="kicker text-terracotta">This week</p>
        <h1 className="editorial-display mt-2 text-5xl text-ink md:text-6xl">
          The Plan
        </h1>
        <div className="rule-draw mt-5 h-px w-full bg-terracotta/40" />
        {viewer.role === "owner" ? <InvitePanel /> : null}
      </header>
      <div className="set set-2 mt-8">
        <PlanView
          recipes={plan?.recipes ?? []}
          manual={plan?.manualItems ?? []}
          groceryIds={plan?.groceryIngredients ?? []}
          pantryIds={plan?.pantryIngredients ?? []}
          ingredients={ingredients}
          recipeScales={plan?.recipeScales ?? []}
        />
      </div>
    </section>
  );
}
