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
          ? "font-hand text-xl text-clay underline decoration-wavy underline-offset-4"
          : "font-hand text-xl text-cocoa transition-colors hover:text-clay"
      }
    >
      {item.label}
    </Link>
  );
}
