# Spec 3b — Pantry View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/pantry` stub with a real, unit-aware Pantry view: each stocked ingredient shows its quantity in the correct canonical unit (grams vs count), is adjustable via a direct numeric input + −/+ nudge, and exposes an editable restock default that overrides the catalog value.

**Architecture:** A pure display-formatting module (`src/lib/kitchen/format-amount.ts`) renders a canonical amount + unit label from an ingredient's `canonicalUnitKind`. The server page `/pantry` fetches the already-display-ready `getPantryData()` (built in 3a — rows carry `name`, `canonicalUnitKind`, `restockOverride`, `restockDefault`) and renders a client `PantryView` that owns optimistic state and calls the Spec 2 server actions `setPantryQuantity` / `setRestockOverride`. Each row is a focused `PantryRow`.

**Tech Stack:** Next.js 16 App Router (server page + client components), Tailwind (existing terracotta tokens + `kicker`/`editorial-display` utilities), `motion/react` (existing `AnimatePresence` exit pattern, optional), `useToast` (existing), Vitest + Testing Library + `@testing-library/user-event`.

---

## Context the implementer needs

- `getPantryData()` (in `src/app/actions/kitchen-data.ts`) returns, per row:
  `{ ingredientId: string; quantityG: number; restockOverride: {quantity:number;unit:string}|null; updatedAt: number; name: string; canonicalUnitKind: "mass"|"volume"|"count"|null; category: string|null; restockDefault: {quantity:number;unit:string}|null }`.
  `quantityG` is the **canonical** amount: grams for mass/volume-kind, an item **count** for count-kind (can be fractional, e.g. 4.8).
- Server actions (in `src/app/actions/kitchen-actions.ts`, already built + tested):
  - `setPantryQuantity(ingredientId: string, quantityG: number)` — sets the canonical quantity (backend rejects negatives).
  - `setRestockOverride(ingredientId: string, restock?: {quantity:number;unit:string})` — set an override; call with `undefined` to clear (fall back to catalog default).
- `CanonicalUnitKind` = `"mass"|"volume"|"count"` from `src/lib/enrichment/types.ts`.
- Existing UI conventions: `useToast()` from `@/components/toast` (call `toast({ message, actionLabel?, onAction? })`); the optimistic `act(action, revert)` pattern from the old `plan-view.tsx`; `kicker` / `editorial-display` / terracotta-`ink`-`paper` Tailwind tokens; the `/menu` stub page is the gate/layout reference.
- Do NOT touch `revalidate()` targets in `kitchen-actions.ts` (still `/plan` — fixed in 3e). The Pantry view uses **optimistic client state** so it does not depend on revalidation to reflect changes on the current page.

---

## File Structure

**Create:**
- `src/lib/kitchen/format-amount.ts` — pure: `roundForDisplay`, `formatCanonicalAmount`, `canonicalUnitLabel`, `pantryNudgeStep`.
- `src/lib/kitchen/format-amount.test.ts` — unit tests.
- `src/components/pantry-row.tsx` — one stock row: amount display + adjust input/nudge + restock override editor (presentational; receives handlers).
- `src/components/pantry-view.tsx` — owns the list, optimistic state, toast/error; renders `PantryRow`s.
- `src/components/pantry-view.test.tsx` — behavior tests.

**Modify:**
- `src/app/(site)/pantry/page.tsx` — replace the stub body with the real `PantryView`, fed by `getPantryData()`.

---

## Task 1: Pure display-format helpers

**Files:**
- Create: `src/lib/kitchen/format-amount.ts`
- Test: `src/lib/kitchen/format-amount.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/lib/kitchen/format-amount.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  roundForDisplay,
  formatCanonicalAmount,
  canonicalUnitLabel,
  pantryNudgeStep,
} from "@/lib/kitchen/format-amount";

describe("roundForDisplay", () => {
  it("keeps whole numbers whole", () => {
    expect(roundForDisplay(200)).toBe(200);
    expect(roundForDisplay(4)).toBe(4);
  });
  it("rounds to at most one decimal", () => {
    expect(roundForDisplay(4.84)).toBe(4.8);
    expect(roundForDisplay(4.85)).toBe(4.9);
    expect(roundForDisplay(0.04)).toBe(0);
  });
});

describe("formatCanonicalAmount", () => {
  it("labels mass and volume kinds in grams", () => {
    expect(formatCanonicalAmount(200, "mass")).toBe("200 g");
    expect(formatCanonicalAmount(355.5, "volume")).toBe("355.5 g");
  });
  it("shows a bare number for count kind (fractional allowed)", () => {
    expect(formatCanonicalAmount(4, "count")).toBe("4");
    expect(formatCanonicalAmount(4.8, "count")).toBe("4.8");
  });
  it("shows a bare number when the kind is unknown", () => {
    expect(formatCanonicalAmount(50, null)).toBe("50");
  });
});

describe("canonicalUnitLabel", () => {
  it("returns g for mass/volume, count for count, units for unknown", () => {
    expect(canonicalUnitLabel("mass")).toBe("g");
    expect(canonicalUnitLabel("volume")).toBe("g");
    expect(canonicalUnitLabel("count")).toBe("count");
    expect(canonicalUnitLabel(null)).toBe("units");
  });
});

describe("pantryNudgeStep", () => {
  it("nudges count by 1 and mass/volume by 10", () => {
    expect(pantryNudgeStep("count")).toBe(1);
    expect(pantryNudgeStep("mass")).toBe(10);
    expect(pantryNudgeStep("volume")).toBe(10);
    expect(pantryNudgeStep(null)).toBe(10);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/kitchen/format-amount.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement** — create `src/lib/kitchen/format-amount.ts`:

```ts
import type { CanonicalUnitKind } from "@/lib/enrichment/types";

export type DisplayKind = CanonicalUnitKind | null;

/** Round to at most one decimal place (trailing .0 dropped by Number). */
export function roundForDisplay(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Human display of a canonical pantry amount. Mass/volume kinds are stored in
 * grams; count kind is a (possibly fractional) item count shown bare.
 */
export function formatCanonicalAmount(quantity: number, kind: DisplayKind): string {
  const n = roundForDisplay(quantity);
  if (kind === "mass" || kind === "volume") return `${n} g`;
  return `${n}`;
}

/** The unit the user types into the adjust input for a given kind. */
export function canonicalUnitLabel(kind: DisplayKind): string {
  if (kind === "mass" || kind === "volume") return "g";
  if (kind === "count") return "count";
  return "units";
}

/** How much a single −/+ nudge changes the canonical amount. */
export function pantryNudgeStep(kind: DisplayKind): number {
  return kind === "count" ? 1 : 10;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/kitchen/format-amount.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/kitchen/format-amount.ts src/lib/kitchen/format-amount.test.ts
git commit -m "feat(3b): pure canonical-amount display helpers (g vs count)"
```

---

## Task 2: `PantryView` + `PantryRow` components

**Files:**
- Create: `src/components/pantry-row.tsx`
- Create: `src/components/pantry-view.tsx`
- Test: `src/components/pantry-view.test.tsx`

This is UI work: implement first, then write behavior tests (per the working agreement). Commit once both pass.

- [ ] **Step 1: Implement `PantryRow`** — create `src/components/pantry-row.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  formatCanonicalAmount,
  canonicalUnitLabel,
  pantryNudgeStep,
  type DisplayKind,
} from "@/lib/kitchen/format-amount";

export type PantryRowData = {
  ingredientId: string;
  name: string;
  quantityG: number;
  canonicalUnitKind: DisplayKind;
  restockOverride: { quantity: number; unit: string } | null;
  restockDefault: { quantity: number; unit: string } | null;
};

export function PantryRow({
  row,
  onSetQuantity,
  onSetRestock,
  onClearRestock,
}: {
  row: PantryRowData;
  onSetQuantity: (next: number) => void;
  onSetRestock: (restock: { quantity: number; unit: string }) => void;
  onClearRestock: () => void;
}) {
  const unit = canonicalUnitLabel(row.canonicalUnitKind);
  const step = pantryNudgeStep(row.canonicalUnitKind);
  const [draft, setDraft] = useState(String(row.quantityG));
  const [editingRestock, setEditingRestock] = useState(false);

  // Keep the input in sync when the parent's optimistic value changes.
  const synced = String(row.quantityG);
  const [lastSynced, setLastSynced] = useState(synced);
  if (synced !== lastSynced) {
    setLastSynced(synced);
    setDraft(synced);
  }

  const commit = (value: number) => {
    const next = Math.max(0, Math.round(value * 10) / 10);
    onSetQuantity(next);
    setDraft(String(next));
  };

  const restock = row.restockOverride ?? row.restockDefault;

  return (
    <li className="flex flex-col gap-2 border-b border-terracotta/15 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="flex-1 text-ink">{row.name}</span>
        <span className="kicker text-ink-soft" aria-hidden>
          {formatCanonicalAmount(row.quantityG, row.canonicalUnitKind)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => commit(row.quantityG - step)}
          aria-label={`Decrease ${row.name}`}
          className="kicker h-8 w-8 rounded-full border border-terracotta/40 text-terracotta hover:bg-terracotta-wash"
        >
          −
        </button>
        <label className="flex items-center gap-1">
          <span className="sr-only">{row.name} quantity</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit(Number(draft) || 0)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit(Number(draft) || 0);
              }
            }}
            aria-label={`${row.name} quantity in ${unit}`}
            className="w-20 border-b border-ink/25 bg-transparent pb-1 text-right text-ink focus:border-terracotta"
          />
          <span className="kicker text-ink-soft">{unit}</span>
        </label>
        <button
          type="button"
          onClick={() => commit(row.quantityG + step)}
          aria-label={`Increase ${row.name}`}
          className="kicker h-8 w-8 rounded-full border border-terracotta/40 text-terracotta hover:bg-terracotta-wash"
        >
          +
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm">
        {editingRestock ? (
          <RestockEditor
            initial={restock}
            onSave={(r) => {
              onSetRestock(r);
              setEditingRestock(false);
            }}
            onCancel={() => setEditingRestock(false)}
          />
        ) : (
          <>
            <span className="text-ink-soft">
              Restock:{" "}
              {restock ? `${restock.quantity} ${restock.unit}`.trim() : "—"}
              {row.restockOverride ? " (custom)" : ""}
            </span>
            <button
              type="button"
              onClick={() => setEditingRestock(true)}
              className="kicker text-terracotta hover:text-terracotta-deep"
            >
              Edit
            </button>
            {row.restockOverride ? (
              <button
                type="button"
                onClick={onClearRestock}
                className="kicker text-ink-soft hover:text-terracotta"
              >
                Reset
              </button>
            ) : null}
          </>
        )}
      </div>
    </li>
  );
}

function RestockEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: { quantity: number; unit: string } | null;
  onSave: (r: { quantity: number; unit: string }) => void;
  onCancel: () => void;
}) {
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? ""));
  const [unit, setUnit] = useState(initial?.unit ?? "");
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const q = Number(quantity);
        if (!Number.isFinite(q) || q <= 0) return;
        onSave({ quantity: q, unit: unit.trim() });
      }}
    >
      <input
        type="number"
        min={0}
        step="any"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        aria-label="Restock quantity"
        className="w-16 border-b border-ink/25 bg-transparent pb-1 text-ink focus:border-terracotta"
      />
      <input
        type="text"
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
        aria-label="Restock unit"
        placeholder="unit"
        maxLength={20}
        className="w-20 border-b border-ink/25 bg-transparent pb-1 text-ink focus:border-terracotta"
      />
      <button type="submit" className="kicker text-terracotta hover:text-terracotta-deep">
        Save
      </button>
      <button type="button" onClick={onCancel} className="kicker text-ink-soft hover:text-terracotta">
        Cancel
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Implement `PantryView`** — create `src/components/pantry-view.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { setPantryQuantity, setRestockOverride } from "@/app/actions/kitchen-actions";
import { PantryRow, type PantryRowData } from "@/components/pantry-row";

const byName = (a: PantryRowData, b: PantryRowData) => a.name.localeCompare(b.name);

export function PantryView({ rows: initialRows }: { rows: PantryRowData[] }) {
  const [rows, setRows] = useState(() => [...initialRows].sort(byName));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  const act = (action: () => Promise<unknown>, revert: () => void) => {
    setError(null);
    start(async () => {
      try {
        await action();
      } catch {
        revert();
        setError("Couldn't save that — please try again.");
      }
    });
  };

  const patch = (id: string, next: Partial<PantryRowData>) =>
    setRows((rs) => rs.map((r) => (r.ingredientId === id ? { ...r, ...next } : r)));

  const setQuantity = (row: PantryRowData, next: number) => {
    const prev = row.quantityG;
    patch(row.ingredientId, { quantityG: next });
    act(
      () => setPantryQuantity(row.ingredientId, next),
      () => patch(row.ingredientId, { quantityG: prev }),
    );
  };

  const setRestock = (row: PantryRowData, restock: { quantity: number; unit: string }) => {
    const prev = row.restockOverride;
    patch(row.ingredientId, { restockOverride: restock });
    act(
      () => setRestockOverride(row.ingredientId, restock),
      () => patch(row.ingredientId, { restockOverride: prev }),
    );
    toast({ message: `Updated restock for ${row.name}` });
  };

  const clearRestock = (row: PantryRowData) => {
    const prev = row.restockOverride;
    patch(row.ingredientId, { restockOverride: null });
    act(
      () => setRestockOverride(row.ingredientId, undefined),
      () => patch(row.ingredientId, { restockOverride: prev }),
    );
  };

  if (rows.length === 0) {
    return (
      <p className="mt-6 text-ink-soft">
        Your pantry is empty — check things off your shopping list and they&rsquo;ll land here.
      </p>
    );
  }

  return (
    <div aria-busy={pending}>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-terracotta-deep">
          {error}
        </p>
      ) : null}
      <ul className="mt-4">
        {rows.map((row) => (
          <PantryRow
            key={row.ingredientId}
            row={row}
            onSetQuantity={(next) => setQuantity(row, next)}
            onSetRestock={(restock) => setRestock(row, restock)}
            onClearRestock={() => clearRestock(row)}
          />
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Write behavior tests** — create `src/components/pantry-view.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const actions = vi.hoisted(() => ({
  setPantryQuantity: vi.fn(),
  setRestockOverride: vi.fn(),
}));
vi.mock("@/app/actions/kitchen-actions", () => actions);
vi.mock("@/components/toast", () => ({ useToast: () => vi.fn() }));

import { PantryView } from "@/components/pantry-view";
import type { PantryRowData } from "@/components/pantry-row";

const ROWS: PantryRowData[] = [
  {
    ingredientId: "beef",
    name: "ground beef",
    quantityG: 200,
    canonicalUnitKind: "mass",
    restockOverride: null,
    restockDefault: { quantity: 1, unit: "lb" },
  },
  {
    ingredientId: "egg",
    name: "egg",
    quantityG: 4,
    canonicalUnitKind: "count",
    restockOverride: { quantity: 12, unit: "" },
    restockDefault: { quantity: 12, unit: "" },
  },
];

beforeEach(() => {
  actions.setPantryQuantity.mockReset().mockResolvedValue(undefined);
  actions.setRestockOverride.mockReset().mockResolvedValue(undefined);
});

const rowFor = (name: string) => screen.getByText(name).closest("li") as HTMLElement;

describe("PantryView", () => {
  it("shows the empty state when there is no stock", () => {
    render(<PantryView rows={[]} />);
    expect(screen.getByText(/pantry is empty/i)).toBeInTheDocument();
  });

  it("renders each row with the correct unit label (g vs count)", () => {
    render(<PantryView rows={ROWS} />);
    expect(within(rowFor("ground beef")).getByText("g")).toBeInTheDocument();
    expect(within(rowFor("egg")).getByText("count")).toBeInTheDocument();
  });

  it("nudging mass up by + steps by 10 grams and calls setPantryQuantity", async () => {
    const user = userEvent.setup();
    render(<PantryView rows={ROWS} />);
    await user.click(within(rowFor("ground beef")).getByLabelText("Increase ground beef"));
    expect(actions.setPantryQuantity).toHaveBeenCalledWith("beef", 210);
  });

  it("nudging count down by − steps by 1 and never goes below 0", async () => {
    const user = userEvent.setup();
    render(<PantryView rows={[{ ...ROWS[1], quantityG: 0 }]} />);
    await user.click(within(rowFor("egg")).getByLabelText("Decrease egg"));
    expect(actions.setPantryQuantity).toHaveBeenCalledWith("egg", 0);
  });

  it("typing a new quantity commits it on blur", async () => {
    const user = userEvent.setup();
    render(<PantryView rows={ROWS} />);
    const input = within(rowFor("ground beef")).getByLabelText("ground beef quantity in g");
    await user.clear(input);
    await user.type(input, "350");
    await user.tab();
    expect(actions.setPantryQuantity).toHaveBeenCalledWith("beef", 350);
  });

  it("editing the restock override saves it via setRestockOverride", async () => {
    const user = userEvent.setup();
    render(<PantryView rows={ROWS} />);
    await user.click(within(rowFor("ground beef")).getByRole("button", { name: "Edit" }));
    const beef = rowFor("ground beef");
    await user.clear(within(beef).getByLabelText("Restock quantity"));
    await user.type(within(beef).getByLabelText("Restock quantity"), "2");
    await user.clear(within(beef).getByLabelText("Restock unit"));
    await user.type(within(beef).getByLabelText("Restock unit"), "lb");
    await user.click(within(beef).getByRole("button", { name: "Save" }));
    expect(actions.setRestockOverride).toHaveBeenCalledWith("beef", { quantity: 2, unit: "lb" });
  });

  it("resetting a custom restock clears the override", async () => {
    const user = userEvent.setup();
    render(<PantryView rows={ROWS} />);
    // egg has a custom override → a Reset button is shown
    await user.click(within(rowFor("egg")).getByRole("button", { name: "Reset" }));
    expect(actions.setRestockOverride).toHaveBeenCalledWith("egg", undefined);
  });
});
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/pantry-view.test.tsx`
Expected: PASS (all cases). If a query is ambiguous (e.g. the `−`/`+` buttons), the `aria-label`s in the component disambiguate — adjust the test query to match the component, not the reverse, only if the component's labels differ.

- [ ] **Step 5: Commit**

```bash
git add src/components/pantry-row.tsx src/components/pantry-view.tsx src/components/pantry-view.test.tsx
git commit -m "feat(3b): PantryView + PantryRow (unit-aware adjust + restock override)"
```

---

## Task 3: Wire the `/pantry` page + full gate

**Files:**
- Modify: `src/app/(site)/pantry/page.tsx`

- [ ] **Step 1: Replace the stub page body**

Replace the entire contents of `src/app/(site)/pantry/page.tsx` with:

```tsx
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { getPantryData } from "@/app/actions/kitchen-data";
import { KitchenSubnav } from "@/components/kitchen-subnav";
import { PantryView } from "@/components/pantry-view";

export default async function PantryPage() {
  const viewer = await getViewer();
  if (!viewer.isAuthenticated) redirect("/");
  if (!viewer.isMember) redirect("/household/setup");

  const rows = await getPantryData();

  return (
    <section className="mx-auto max-w-2xl">
      <KitchenSubnav />
      <header className="set set-1 mt-6">
        <p className="kicker text-terracotta">Your kitchen</p>
        <h1 className="editorial-display mt-2 text-4xl text-ink md:text-5xl">Pantry</h1>
        <div className="rule-draw mt-5 h-px w-full bg-terracotta/40" />
      </header>
      <PantryView rows={rows} />
    </section>
  );
}
```

Note: `getPantryData()` returns rows whose fields are a superset of `PantryRowData` (it also has `updatedAt`/`category`). Passing them to `PantryView` (typed `PantryRowData[]`) is structurally compatible in TypeScript (extra properties on an already-typed array are allowed). If `tsc` complains about the array assignment, map to the exact shape in the page:
`rows={rows.map(({ ingredientId, name, quantityG, canonicalUnitKind, restockOverride, restockDefault }) => ({ ingredientId, name, quantityG, canonicalUnitKind, restockOverride, restockDefault }))}`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. If the array assignment errors, apply the explicit map shown above and re-run.

- [ ] **Step 3: Full gate**

Run: `npx vitest run && npm run lint && npx tsc --noEmit`
Expected: all pass — full suite green (prior + new format-amount + pantry-view tests), lint clean, types clean.

- [ ] **Step 4: Convex smoke check (no Convex changes)**

Run: `npx convex dev --once`
Expected: deploys clean. (If it can't run non-interactively, note and proceed.)

- [ ] **Step 5: Commit**

```bash
git add "src/app/(site)/pantry/page.tsx"
git commit -m "feat(3b): wire /pantry page to the real PantryView"
```

---

## Post-implementation gate (whole sub-plan)

- [ ] Full gate green: `npx vitest run` + `npm run lint` + `npx tsc --noEmit` + `npx convex dev --once`.
- [ ] `/code-review` (or a holistic reviewer) across the 3b commits; address findings (just-apply small fixes; surface flow/architecture/scope changes).
- [ ] Confirm behavior: `/pantry` lists stock with correct g-vs-count labels; −/+ and typing adjust quantity (clamped ≥0); restock override edit + reset work; empty state renders.

---

## Self-review notes (coverage vs the Spec 3 design §4.3)

- "stock with quantities, correct unit label (g vs count)" → Task 1 helpers + Task 2 row display.
- "direct numeric input + −/+ nudge → setPantryQuantity" → Task 2 `PantryRow` adjust controls + Task 2 tests.
- "restock default visible/overridable → setRestockOverride; clearing falls back to catalog default" → Task 2 `RestockEditor` + reset + tests.
- "count amounts may be fractional; display rounds to a sensible precision while storing exact" → `roundForDisplay` (display) + the input commits `Math.max(0, round1dp)`; the stored value is whatever is committed (fractional allowed).
- "empty state" → Task 2 `PantryView`.
- Out of scope (later sub-plans): category grouping is Shop-only (3c); fixing `revalidate()`/robots is 3e; the Menu/Shop views are 3c–3d. Pantry sorts alphabetically by name (no category grouping) by design.
