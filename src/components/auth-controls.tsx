"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";

export function AuthControls() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="kicker text-ink-soft/50">···</span>;
  }

  if (session?.user) {
    return (
      <span className="flex items-center gap-3">
        {session.user.isEditor ? (
          <Link
            href="/plan"
            className="kicker text-ink-soft transition-colors hover:text-terracotta"
          >
            Plan
          </Link>
        ) : null}
        {session.user.name ? (
          <span className="kicker hidden text-ink-soft sm:inline">
            {session.user.name}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => signOut()}
          className="kicker text-ink-soft transition-colors hover:text-terracotta"
        >
          Sign out
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => signIn("google")}
      className="kicker text-ink-soft transition-colors hover:text-terracotta"
    >
      Sign in
    </button>
  );
}
