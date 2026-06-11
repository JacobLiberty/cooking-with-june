import { notFound } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { MigrateRunner } from "@/components/migrate-runner";

export default async function MigratePage() {
  const viewer = await getViewer();
  if (viewer.role !== "owner") notFound();

  return (
    <section className="mx-auto max-w-2xl py-8">
      <h1 className="editorial-display text-3xl text-ink">Migrate plan &amp; pantry</h1>
      <p className="editorial-aside mt-2 text-ink-soft">
        One-time: move the old global plan into your household. Seeds pantry at
        restock defaults — review and correct quantities afterward in the Pantry.
      </p>
      <div className="mt-6">
        <MigrateRunner />
      </div>
    </section>
  );
}
