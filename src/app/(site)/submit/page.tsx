import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { client } from "@/sanity/lib/client";
import { TAGS_QUERY } from "@/sanity/lib/queries";
import type { TagOption } from "@/sanity/types";
import { ImportReview } from "@/components/import-review";

export default async function SubmitPage() {
  const viewer = await getViewer();
  if (!viewer.isAuthenticated) redirect("/");
  if (!viewer.isMember) redirect("/household/setup");

  const tags = await client.fetch<TagOption[]>(TAGS_QUERY);

  return (
    <section className="mx-auto max-w-2xl">
      <header className="set set-1">
        <p className="kicker text-terracotta">Add a recipe</p>
        <h1 className="editorial-display mt-2 text-4xl text-ink md:text-5xl">Submit</h1>
        <p className="editorial-aside mt-3 text-ink-soft">
          Paste a recipe and June&rsquo;s kitchen will normalize it: ingredients,
          steps, macros, and a cover.
        </p>
        <div className="rule-draw mt-5 h-px w-full bg-terracotta/40" />
      </header>
      <ImportReview tags={tags} />
    </section>
  );
}
