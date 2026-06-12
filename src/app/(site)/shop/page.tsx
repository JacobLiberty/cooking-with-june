import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { client } from "@/sanity/lib/client";
import { INGREDIENTS_QUERY } from "@/sanity/lib/queries";
import type { IngredientOption } from "@/sanity/types";
import { getShopData } from "@/app/actions/kitchen-data";
import { KitchenSubnav } from "@/components/kitchen-subnav";
import { ShopView } from "@/components/shop-view";

export default async function ShopPage() {
  const viewer = await getViewer();
  if (!viewer.isAuthenticated) redirect("/");
  if (!viewer.isMember) redirect("/household/setup");

  const [{ needs, manual }, catalog] = await Promise.all([
    getShopData(),
    // Fresh (not CDN-cached) so a just-created catalog ingredient is selectable;
    // matches the other kitchen pages.
    client.withConfig({ useCdn: false }).fetch<IngredientOption[]>(INGREDIENTS_QUERY),
  ]);

  return (
    <section className="mx-auto max-w-2xl">
      <KitchenSubnav />
      <header className="set set-1 mt-6">
        <p className="kicker text-terracotta">This week</p>
        <h1 className="editorial-display mt-2 text-4xl text-ink md:text-5xl">Shop</h1>
        <div className="rule-draw mt-5 h-px w-full bg-terracotta/40" />
      </header>
      <ShopView needs={needs} manual={manual} catalog={catalog} />
    </section>
  );
}
