import Link from "next/link";
import { navItems } from "@/lib/nav";
import { NavLink } from "@/components/nav-link";
import { AuthControls } from "@/components/auth-controls";
import { JuneArt } from "@/components/june";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-olive/25 bg-paper/95">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
        <Link href="/" className="flex items-center gap-2">
          <JuneArt pose="head" className="h-9 w-auto" priority />
          <span className="editorial-display text-2xl text-ink">
            Cooking with June
          </span>
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-7">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
          <AuthControls />
        </nav>
      </div>
    </header>
  );
}
