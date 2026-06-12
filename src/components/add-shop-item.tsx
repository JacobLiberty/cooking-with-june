"use client";

import { useMemo, useState } from "react";
import type { IngredientOption } from "@/sanity/types";

/**
 * Catalog typeahead. Picking a suggestion or creating a new name both submit the
 * NAME upward; the server resolves it to a catalog id (creating + enriching if
 * missing). No free-text grocery path — every item maps to the catalog.
 */
export function AddShopItem({
  catalog,
  onAdd,
}: {
  catalog: IngredientOption[];
  onAdd: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!q) return [];
    return catalog.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [catalog, q]);

  const exact = catalog.some((c) => c.name.toLowerCase() === q);

  const submit = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    onAdd(clean);
    setQuery("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(query);
      }}
      className="mt-6"
      role="search"
    >
      <label className="flex items-center gap-3">
        <span className="sr-only">Add a grocery item</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={80}
          placeholder="Add an item…"
          aria-label="Add a grocery item"
          className="flex-1 border-b border-ink/25 bg-transparent pb-1 text-ink placeholder:text-ink-soft focus:border-terracotta"
        />
        <button type="submit" className="kicker text-terracotta hover:text-terracotta-deep">
          Add
        </button>
      </label>

      {q ? (
        <ul className="mt-2 space-y-1">
          {matches.map((c) => (
            <li key={c._id}>
              <button
                type="button"
                onClick={() => submit(c.name)}
                className="kicker text-ink-soft hover:text-terracotta"
              >
                {c.name}
              </button>
            </li>
          ))}
          {!exact ? (
            <li>
              <button
                type="button"
                onClick={() => submit(query)}
                className="kicker text-terracotta hover:text-terracotta-deep"
              >
                Create &ldquo;{query.trim()}&rdquo;
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </form>
  );
}
