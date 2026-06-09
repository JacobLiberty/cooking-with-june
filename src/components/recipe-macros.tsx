import type { RecipeMacros } from "@/sanity/types";

const FIELDS = [
  { key: "calories", label: "Calories", unit: "" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "carbs", label: "Carbs", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
] as const;

/**
 * Per-serving nutrition for a recipe. Shows a base–full range when the recipe
 * has optional ingredients (base = required only, full = including optional);
 * otherwise a single figure. Renders nothing until macros have been computed.
 */
export function RecipeMacrosPanel({ macros }: { macros?: RecipeMacros | null }) {
  const base = macros?.base;
  if (!base) return null;
  const full = macros?.full;

  return (
    <section
      aria-labelledby="macros-heading"
      className="mt-8 border-t border-terracotta/25 pt-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="macros-heading" className="kicker text-terracotta">
          Nutrition · per serving
        </h2>
        {macros?.estimated ? (
          <span
            className="kicker rounded-full bg-ink/5 px-2 py-0.5 text-ink-soft"
            title="Estimated from USDA data; quantities are approximate and some ingredients may be excluded."
          >
            ≈ estimated
          </span>
        ) : null}
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
        {FIELDS.map(({ key, label, unit }) => {
          const b = base[key];
          const f = full?.[key];
          if (b == null && f == null) return null;
          const range = f != null && b != null && f !== b;
          return (
            <div key={key}>
              <dt className="kicker text-ink-soft">{label}</dt>
              <dd className="text-lg text-ink">
                {range ? `${b}–${f}${unit}` : `${b ?? f}${unit}`}
              </dd>
            </div>
          );
        })}
      </dl>

      {macros?.unparsedLines?.length ? (
        <p className="mt-2 text-sm text-ink-soft">
          Not counted: {macros.unparsedLines.join(", ")}.
        </p>
      ) : null}
    </section>
  );
}
