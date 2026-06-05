"use client";

import { useState } from "react";
import Link from "next/link";
import { cookProgress } from "@/lib/cook-progress";
import { parseStepTimers, ingredientsInStep } from "@/lib/cook-extras";
import { useWakeLock } from "@/lib/use-wake-lock";
import { PawMark } from "@/components/paw-mark";
import { StepTimer } from "@/components/step-timer";
import type { IngredientLineView } from "@/sanity/types";

export function CookMode({
  title,
  slug,
  steps,
  ingredients,
}: {
  title: string;
  slug: string;
  steps: string[];
  ingredients: IngredientLineView[];
}) {
  useWakeLock(true);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [showIngredients, setShowIngredients] = useState(false);
  const p = cookProgress(index, steps.length);

  const currentText = steps[p.current] ?? "";
  const timers = parseStepTimers(currentText);
  const stepIngredients = ingredientsInStep(
    currentText,
    ingredients.map((l) => l.name),
  );

  const markDone = () => setDone((d) => new Set(d).add(p.current));
  const next = () => {
    markDone();
    setIndex((i) => Math.min(i + 1, steps.length - 1));
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col">
      <div className="flex items-center justify-between">
        <Link href={`/recipe/${slug}`} className="kicker text-ink-soft hover:text-terracotta">
          Exit
        </Link>
        <span className="kicker text-ink-soft">{title}</span>
        <button
          type="button"
          onClick={() => setShowIngredients((s) => !s)}
          className="kicker text-ink-soft hover:text-terracotta"
          aria-expanded={showIngredients}
        >
          Ingredients
        </button>
      </div>

      {showIngredients ? (
        <ul className="mt-4 rounded-none border border-ink/15 bg-paper-sunk p-4 [font-variant-numeric:tabular-nums]">
          {ingredients.map((line) => (
            <li key={line._key} className="text-ink">
              <span className="text-ink-soft">
                {[line.quantity, line.unit].filter(Boolean).join(" ")}
              </span>{" "}
              {line.name ?? "—"}
            </li>
          ))}
        </ul>
      ) : null}

      {/* pawprint progress — tap to jump to a step */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        {steps.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Go to step ${i + 1}`}
            aria-current={i === p.current ? "step" : undefined}
            className="grid h-11 w-11 place-items-center"
          >
            <PawMark
              className={`h-4 w-4 ${
                done.has(i) || i < p.current
                  ? "text-clay"
                  : i === p.current
                    ? "text-terracotta"
                    : "text-ink/20"
              }`}
            />
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-1 flex-col justify-center">
        <p className="kicker text-terracotta">
          Step {p.total === 0 ? 0 : p.current + 1} of {p.total}
        </p>
        <p className="mt-3 text-3xl leading-snug text-ink md:text-5xl">
          {steps[p.current] ?? "No steps yet."}
        </p>

        {stepIngredients.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {stepIngredients.map((name) => (
              <span
                key={name}
                className="kicker rounded-full bg-paper-sunk px-2.5 py-1 text-ink-soft"
              >
                {name}
              </span>
            ))}
          </div>
        ) : null}

        {timers.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-3">
            {timers.map((t) => (
              <StepTimer key={t.seconds} timer={t} />
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-8 flex items-center justify-between gap-4 border-t border-terracotta/25 pt-4">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(i - 1, 0))}
          disabled={p.current === 0}
          aria-label="Back"
          className="kicker flex min-h-12 items-center px-4 text-ink-soft hover:text-terracotta disabled:opacity-30"
        >
          <span aria-hidden>←</span> Back
        </button>
        {p.isLast ? (
          <Link
            href={`/recipe/${slug}`}
            onClick={markDone}
            aria-label="Done"
            className="kicker flex min-h-12 items-center rounded-full border border-terracotta bg-terracotta px-6 text-paper hover:bg-terracotta-deep"
          >
            Done <span aria-hidden>✓</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={next}
            aria-label="Next"
            className="kicker flex min-h-12 items-center rounded-full border border-terracotta bg-terracotta-wash px-6 text-terracotta hover:bg-terracotta hover:text-paper"
          >
            Next <span aria-hidden>→</span>
          </button>
        )}
      </div>
    </div>
  );
}
