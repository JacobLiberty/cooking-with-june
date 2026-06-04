"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addNote } from "@/app/actions/recipe-actions";

export function AddNoteForm({ recipeId }: { recipeId: string }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    start(async () => {
      const res = await addNote(recipeId, t);
      if (res.ok) {
        setText("");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="mt-3 flex items-center gap-3">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        placeholder="Add a note…"
        className="flex-1 border-b border-ink/25 bg-transparent pb-1 text-ink placeholder:text-ink-soft/60 focus:border-terracotta"
      />
      <button
        type="submit"
        disabled={pending}
        className="kicker text-terracotta hover:text-terracotta-deep disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add"}
      </button>
    </form>
  );
}
