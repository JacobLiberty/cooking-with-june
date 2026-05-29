"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActivePath, type NavItem } from "@/lib/nav";

export function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = isActivePath(pathname, item.href);

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "kicker border-b border-heather pb-1 text-heather"
          : "kicker pb-1 text-ink-soft transition-colors hover:text-heather"
      }
    >
      {item.label}
    </Link>
  );
}
