"use client";

import { useSession, signIn, signOut } from "next-auth/react";

export function AuthControls() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="kicker text-ink-soft/50">···</span>;
  }

  if (session?.user) {
    return (
      <span className="flex items-center gap-3">
        {session.user.name ? (
          <span className="kicker text-ink-soft">{session.user.name}</span>
        ) : null}
        <button
          type="button"
          onClick={() => signOut()}
          className="kicker text-ink-soft transition-colors hover:text-heather"
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
      className="kicker text-ink-soft transition-colors hover:text-heather"
    >
      Sign in
    </button>
  );
}
