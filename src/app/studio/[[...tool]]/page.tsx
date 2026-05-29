import { redirect } from "next/navigation";
import { NextStudio } from "next-sanity/studio";
import config from "../../../../sanity.config";
import { getViewer } from "@/lib/viewer";

export { metadata, viewport } from "next-sanity/studio";

// Gate the embedded Studio to signed-in editors (Sanity also enforces its own
// login, but this keeps Studio + Vision consistent with the app's auth model).
// Using auth() makes this route dynamic — that's the intended tradeoff.
export default async function StudioPage() {
  const viewer = await getViewer();
  if (!viewer.isEditor) redirect("/");
  return <NextStudio config={config} />;
}
