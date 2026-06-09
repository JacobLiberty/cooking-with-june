"use client";

import { JuneArt } from "@/components/june";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-5 text-center">
      <JuneArt pose="sleeping" className="h-40 w-auto" />
      <p className="kicker mt-6 text-terracotta-deep">Something went sideways</p>
      <h1 className="editorial-display mt-2 text-4xl text-ink md:text-5xl">
        June spilled the sauce
      </h1>
      <p className="mt-4 text-ink-soft">
        A little kitchen mishap on our end. Let&rsquo;s try that again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="kicker mt-6 border border-terracotta px-4 py-2 text-terracotta hover:bg-terracotta-wash"
      >
        Try again
      </button>
    </div>
  );
}
