"use client";

import Link from "next/link";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";

export function AuthControls() {
  const { signIn, signOut } = useAuthActions();
  const me = useQuery(api.users.me);

  if (me === undefined) {
    return <span className="kicker text-ink-soft">···</span>;
  }

  if (me) {
    return (
      <span className="flex items-center gap-3">
        <Link
          href="/plan"
          className="kicker text-ink-soft transition-colors hover:text-terracotta"
        >
          Plan
        </Link>
        {me.name ? (
          <span className="kicker hidden text-ink-soft sm:inline">{me.name}</span>
        ) : null}
        <button
          type="button"
          onClick={() => void signOut()}
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
      onClick={() => void signIn("google")}
      className="kicker text-ink-soft transition-colors hover:text-terracotta"
    >
      Sign in
    </button>
  );
}
