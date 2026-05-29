import Link from "next/link";
import { navItems } from "@/lib/nav";
import { NavLink } from "@/components/nav-link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-terracotta/50 bg-cream/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          {/* 🐱 stands in for June's artwork until a later phase */}
          <span aria-hidden className="text-2xl">
            🐱
          </span>
          <span className="font-hand text-2xl text-clay">Cooking with June</span>
        </Link>
        <nav aria-label="Primary" className="flex gap-6">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>
      </div>
    </header>
  );
}
