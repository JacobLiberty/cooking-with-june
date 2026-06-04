import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { client } from "@/sanity/lib/client";
import { PLAN_QUERY } from "@/sanity/lib/plan-queries";
import type { PlanData } from "@/sanity/plan-types";
import { buildGroceryList } from "@/lib/grocery";
import { PlanView } from "@/components/plan-view";

export default async function PlanPage() {
  const viewer = await getViewer();
  if (!viewer.isEditor) redirect("/");

  const plan = await client
    .withConfig({ useCdn: false })
    .fetch<PlanData | null>(PLAN_QUERY);

  const recipes = plan?.recipes ?? [];
  const checked = new Set(plan?.checkedIngredients ?? []);
  const all = buildGroceryList(recipes.map((r) => r.ingredients ?? []));
  const toGet = all.filter((g) => !checked.has(g.ingredientId));
  const got = all.filter((g) => checked.has(g.ingredientId));

  return (
    <section className="mx-auto max-w-2xl">
      <header className="set set-1">
        <p className="kicker text-terracotta">This week</p>
        <h1 className="editorial-display mt-2 text-5xl text-ink md:text-6xl">
          The Plan
        </h1>
        <div className="rule-draw mt-5 h-px w-full bg-terracotta/40" />
      </header>
      <div className="set set-2 mt-8">
        <PlanView
          recipes={recipes}
          toGet={toGet}
          got={got}
          manual={plan?.manualItems ?? []}
        />
      </div>
    </section>
  );
}
