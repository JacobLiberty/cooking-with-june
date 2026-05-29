export default function HomePage() {
  return (
    <section className="py-8 md:py-16">
      <p className="kicker set set-1 text-heather">A home cookbook</p>
      <h1 className="editorial-display set set-2 mt-3 text-5xl text-ink md:text-7xl">
        Cooking with June
      </h1>
      <div className="rule-draw mt-6 h-px w-full bg-heather/40" />
      <p className="dropcap set set-3 mt-6 max-w-2xl text-lg leading-relaxed text-ink md:text-xl">
        A warm, well-kept collection of the things we actually cook — gathered,
        rated, and quietly supervised by June. Recipes are on their way.
      </p>
    </section>
  );
}
