import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About · Cooking with June",
};

export default function AboutPage() {
  return (
    <section className="py-8 md:py-16">
      <p className="kicker set set-1 text-heather">About</p>
      <h1 className="editorial-display set set-2 mt-3 text-5xl text-ink md:text-6xl">
        About June
      </h1>
      <div className="rule-draw mt-6 h-px w-full bg-heather/40" />
      <p className="dropcap set set-3 mt-6 max-w-2xl text-lg leading-relaxed text-ink">
        June is our orange cat and self-appointed head of the kitchen. This is the
        cookbook Jacob &amp; Lily are building around him — a place for the meals
        worth making twice.
      </p>
      <p
        className="set set-4 mt-5 max-w-2xl text-xl italic text-heather"
        style={{ fontFamily: "var(--font-display)" }}
      >
        More of his story is coming soon.
      </p>
    </section>
  );
}
