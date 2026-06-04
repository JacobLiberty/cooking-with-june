import type { Metadata } from "next";
import { JuneArt } from "@/components/june";

export const metadata: Metadata = {
  title: "About · Cooking with June",
};

export default function AboutPage() {
  return (
    <section className="mx-auto max-w-2xl py-8 md:py-16">
      <p className="kicker set set-1 text-olive">About</p>
      <h1 className="editorial-display set set-2 mt-3 text-5xl text-ink md:text-6xl">
        About June
      </h1>
      <div className="rule-draw mt-5 h-px w-full bg-olive/40" />
      <div className="set set-3 mt-8 flex justify-center">
        <JuneArt pose="loaf" className="h-32 w-auto" />
      </div>
      <p className="dropcap set set-3 mt-6 text-lg leading-relaxed text-ink">
        June is our brown tabby cat and self-appointed head of the kitchen. He
        supervises from the windowsill, inspects every grocery haul, and has
        strong opinions about anything involving butter.
      </p>
      <p className="mt-5 leading-relaxed text-ink">
        This is the cookbook Jacob &amp; Lily are building around him — a warm,
        well-kept place for the meals worth making twice. Recipes get a photo, a
        story, the ingredients we actually used, and our honest ratings, so the
        good ones are easy to find again.
      </p>
      <p className="editorial-aside set set-4 mt-6 text-xl text-olive">
        Made with care, and supervised with suspicion. — J &amp; L (and June)
      </p>
    </section>
  );
}
