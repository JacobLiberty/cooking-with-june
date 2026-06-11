import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { HouseholdSetup } from "@/components/household-setup";

// Onboarding gate: signed-in users without a household land here.
export default async function HouseholdSetupPage() {
  const viewer = await getViewer();
  if (!viewer.isAuthenticated) redirect("/");
  if (viewer.isMember) redirect("/plan");
  return <HouseholdSetup />;
}
