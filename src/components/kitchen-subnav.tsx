"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const KITCHEN_LINKS = [
  { href: "/menu", label: "Menu" },
  { href: "/shop", label: "Shop" },
  { href: "/pantry", label: "Pantry" },
  { href: "/household", label: "Household" },
] as const;

export function KitchenSubnav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Kitchen" className="flex gap-2">
      {KITCHEN_LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`kicker rounded-full px-4 py-2 transition-colors ${
              active
                ? "bg-terracotta text-paper"
                : "text-ink-soft hover:text-terracotta"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
