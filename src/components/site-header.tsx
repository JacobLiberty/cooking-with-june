import Link from "next/link";
import { navItems } from "@/lib/nav";
import { NavLink } from "@/components/nav-link";
import { PawMark } from "@/components/paw-mark";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-heather/25 bg-paper/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
        <Link href="/" className="flex items-center gap-2">
          <PawMark className="h-4 w-4 text-clay" />
          <span className="editorial-display text-2xl text-ink">
            Cooking with June
          </span>
        </Link>
        <nav aria-label="Primary" className="flex gap-7">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>
      </div>
    </header>
  );
}
