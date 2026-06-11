"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@cvx/_generated/api";

// Owner-only: generate a shareable invite code for the household.
export function InvitePanel() {
  const createInvite = useMutation(api.households.createInvite);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      setCode(await createInvite({}));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => void generate()}
        disabled={busy}
        className="kicker min-h-9 rounded-full border border-terracotta px-4 text-terracotta transition-colors hover:bg-terracotta hover:text-paper disabled:opacity-50"
      >
        Invite someone
      </button>
      {code ? (
        <span className="kicker inline-flex items-center gap-2 text-ink-soft">
          Share this code:
          <code
            className="rounded bg-ink/5 px-2 py-1 font-mono text-ink"
            aria-label="invite code"
          >
            {code}
          </code>
          <span className="text-ink-soft/70">(expires in 7 days)</span>
        </span>
      ) : null}
    </div>
  );
}
