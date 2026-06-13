import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { getPantryData } from "@/app/actions/kitchen-data";
import { KitchenSubnav } from "@/components/kitchen-subnav";
import { PantryView } from "@/components/pantry-view";

export default async function PantryPage() {
  const viewer = await getViewer();
  if (!viewer.isAuthenticated) redirect("/");
  if (!viewer.isMember) redirect("/household/setup");

  const rows = await getPantryData();

  return (
    <section className="mx-auto max-w-2xl">
      <KitchenSubnav />
      <header className="set set-1 mt-6">
        <p className="kicker text-terracotta">
          Your kitchen{rows.length ? ` · ${rows.length} ingredient${rows.length === 1 ? "" : "s"}` : ""}
        </p>
        <h1 className="editorial-display mt-2 text-4xl text-ink md:text-5xl">Pantry</h1>
        <div className="rule-draw mt-5 h-px w-full bg-terracotta/40" />
      </header>
      <PantryView
        rows={rows.map(({ ingredientId, name, quantityG, canonicalUnitKind, category, onList }) => ({
          ingredientId,
          name,
          quantityG,
          canonicalUnitKind,
          category,
          onList,
        }))}
      />
    </section>
  );
}
