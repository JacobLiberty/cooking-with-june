import { PawMark } from "@/components/paw-mark";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-heather/25">
      <div className="mx-auto flex max-w-5xl items-center justify-center gap-2 px-5 py-8 text-ink-soft">
        <PawMark className="h-3.5 w-3.5 text-clay" />
        <span className="kicker">Made with care by Jacob &amp; Lily</span>
      </div>
    </footer>
  );
}
