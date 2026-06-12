"use client";

import Link from "next/link";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";

export function AuthControls() {
  const { signIn, signOut } = useAuthActions();
  const viewer = useQuery(api.households.viewer);

  if (viewer === undefined) {
    return <span className="kicker text-ink-soft">···</span>;
  }

  if (viewer) {
    return (
      <span className="flex items-center gap-3">
        {viewer.householdId ? (
          <Link
            href="/menu"
            className="kicker text-ink-soft transition-colors hover:text-terracotta"
          >
            Kitchen
          </Link>
        ) : (
          <Link
            href="/household/setup"
            className="kicker text-clay transition-colors hover:text-terracotta"
          >
            Finish setup
          </Link>
        )}
        {viewer.name ? (
          <span className="kicker hidden text-ink-soft sm:inline">
            {viewer.name}
          </span>
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
