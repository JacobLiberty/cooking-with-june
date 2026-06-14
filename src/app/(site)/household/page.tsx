import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { KitchenSubnav } from "@/components/kitchen-subnav";
import { InvitePanel } from "@/components/invite-panel";

// Member-only household page: the owner generates shareable invite codes here.
export default async function HouseholdPage() {
  const viewer = await getViewer();
  if (!viewer.isAuthenticated) redirect("/");
  if (!viewer.isMember) redirect("/household/setup");

  return (
    <section className="mx-auto max-w-2xl">
      <KitchenSubnav />
      <header className="set set-1 mt-6">
        <p className="kicker text-terracotta">Your household</p>
        <h1 className="editorial-display mt-2 text-4xl text-ink md:text-5xl">Household</h1>
        <div className="rule-draw mt-5 h-px w-full bg-terracotta/40" />
      </header>

      {viewer.role === "owner" ? (
        <div className="mt-6">
          <h2 className="kicker text-ink-soft">Invite a partner</h2>
          <p className="mt-2 text-ink">
            Generate a code and share it. They sign in with Google, then enter the
            code on the welcome screen to join your household. Each code works once
            and expires after 7 days.
          </p>
          <InvitePanel />
        </div>
      ) : (
        <p className="mt-6 text-ink">
          You&rsquo;re a member of this household. Only the owner can invite new members.
        </p>
      )}
    </section>
  );
}
