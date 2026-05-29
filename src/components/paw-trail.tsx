import { PawMark } from "@/components/paw-mark";

export function PawTrail({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-24" role="status" aria-live="polite">
      <div className="flex items-end gap-2">
        {[1, 2, 3, 4].map((n) => (
          <PawMark
            key={n}
            className={`paw-step paw-step-${n} h-5 w-5 text-clay ${n % 2 === 0 ? "translate-y-1" : ""}`}
          />
        ))}
      </div>
      <span className="kicker text-ink-soft">{label}</span>
    </div>
  );
}
