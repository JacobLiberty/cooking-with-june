import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { getMenuData } from "@/app/actions/kitchen-data";
import { KitchenSubnav } from "@/components/kitchen-subnav";
import { MenuView } from "@/components/menu-view";

export default async function MenuPage() {
  const viewer = await getViewer();
  if (!viewer.isAuthenticated) redirect("/");
  if (!viewer.isMember) redirect("/household/setup");

  const rows = await getMenuData();

  return (
    <section className="mx-auto max-w-2xl">
      <KitchenSubnav />
      <header className="set set-1 mt-6">
        <p className="kicker text-terracotta">Cooking soon</p>
        <h1 className="editorial-display mt-2 text-4xl text-ink md:text-5xl">Menu</h1>
        <div className="rule-draw mt-5 h-px w-full bg-terracotta/40" />
      </header>
      <MenuView rows={rows} />
    </section>
  );
}
