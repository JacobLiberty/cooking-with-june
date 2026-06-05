import { PawMark } from "@/components/paw-mark";

export function JuneApprovedBadge({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 leading-none ${className ?? ""}`}
      title="June approved — you both rated this 4.5★ or higher"
    >
      <PawMark className="h-3 w-3 shrink-0 text-clay" />
      <span className="kicker text-terracotta">June approved</span>
    </span>
  );
}
