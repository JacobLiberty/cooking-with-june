import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { KitchenSubnav } from "@/components/kitchen-subnav";

export default async function MenuPage() {
  const viewer = await getViewer();
  if (!viewer.isAuthenticated) redirect("/");
  if (!viewer.isMember) redirect("/household/setup");

  return (
    <section className="mx-auto max-w-2xl">
      <KitchenSubnav />
      <h1 className="editorial-display mt-6 text-4xl text-ink">Menu</h1>
      <p className="mt-3 text-ink-soft">Coming soon.</p>
    </section>
  );
}
