"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@cvx/_generated/api";

export function HouseholdSetup({ canCreate = true }: { canCreate?: boolean }) {
  const router = useRouter();
  const createHousehold = useMutation(api.households.createHousehold);
  const acceptInvite = useMutation(api.households.acceptInvite);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await action();
      router.push("/menu");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-md">
      <header className="set set-1">
        <p className="kicker text-terracotta">Welcome</p>
        <h1 className="editorial-display mt-2 text-4xl text-ink">
          Set up your household
        </h1>
        <p className="mt-3 text-ink-soft">
          A household shares one pantry, grocery list, and meal plan. Create a
          new one, or join an existing household with an invite code.
        </p>
        <div className="rule-draw mt-5 h-px w-full bg-terracotta/40" />
      </header>

      {error ? (
        <p role="alert" className="mt-5 text-clay">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-8">
        {canCreate ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => createHousehold({ name }));
            }}
          >
            <h2 className="kicker text-ink-soft">Create a household</h2>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jacob &amp; Lily"
              aria-label="Household name"
              className="min-h-11 rounded-lg border border-ink/20 bg-paper px-3 text-ink focus-visible:border-terracotta focus-visible:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="kicker min-h-11 rounded-full bg-terracotta px-6 text-paper transition-colors hover:bg-terracotta-deep disabled:opacity-50"
            >
              Create household
            </button>
          </form>
        ) : null}

        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => acceptInvite({ code }));
          }}
        >
          <h2 className="kicker text-ink-soft">Join with a code</h2>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Invite code"
            aria-label="Invite code"
            autoCapitalize="characters"
            className="min-h-11 rounded-lg border border-ink/20 bg-paper px-3 font-mono uppercase text-ink focus-visible:border-terracotta focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !code.trim()}
            className="kicker min-h-11 rounded-full border border-terracotta px-6 text-terracotta transition-colors hover:bg-terracotta hover:text-paper disabled:opacity-50"
          >
            Join household
          </button>
        </form>
      </div>
    </section>
  );
}
