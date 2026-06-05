import Link from "next/link";
import { navItems } from "@/lib/nav";
import { NavLink } from "@/components/nav-link";
import { AuthControls } from "@/components/auth-controls";
import { JuneArt } from "@/components/june";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-terracotta/25 bg-paper/95">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <Link href="/" className="flex items-center gap-2">
          <JuneArt pose="loaf" className="h-8 w-auto sm:h-9" priority />
          <span className="editorial-display text-lg text-ink sm:text-2xl">
            Cooking with June
          </span>
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-3 sm:gap-7">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
          <AuthControls />
        </nav>
      </div>
    </header>
  );
}
