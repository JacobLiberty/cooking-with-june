"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@cvx/_generated/api";

export function AddNoteForm({ recipeId }: { recipeId: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const addNote = useMutation(api.notes.add);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setError(null);
    start(async () => {
      try {
        await addNote({ recipeId, text: t });
        setText("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't add the note");
      }
    });
  }

  return (
    <form onSubmit={submit} className="mt-3">
      <div className="flex items-center gap-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          aria-label="Add a note"
          placeholder="Add a note…"
          className="flex-1 border-b border-ink/25 bg-transparent pb-1 text-ink placeholder:text-ink-soft focus:border-terracotta"
        />
        <button
          type="submit"
          disabled={pending}
          className="kicker text-terracotta hover:text-terracotta-deep disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      {error ? <p className="mt-1 text-sm text-terracotta-deep">{error}</p> : null}
    </form>
  );
}
