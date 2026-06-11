# Foundation 1a — Convex + Convex Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a Convex backend and move authentication from next-auth to Convex Auth (Google), with a `users` table and a `me` query, while keeping the existing `getViewer()`/`requireEditor()` editor semantics intact so the rest of the app keeps working.

**Architecture:** Add a Convex project (`convex/` at repo root). Use `@convex-dev/auth` for Google OAuth — Convex now owns the session/JWT. The server-side `getViewer()` helper is re-implemented on top of the Convex token but keeps its exact return shape (`{ isEditor, editorId, name }`) by resolving the signed-in email against the existing Sanity `editor` documents. This is a transitional bridge: households (Plan 1b) and the data migration (Plan 1c) replace the editor-allowlist semantics later. No Sanity recipe/ingredient content changes in this plan.

**Tech Stack:** Next.js 16 (App Router, `src/` dir), Convex, `@convex-dev/auth`, `@auth/core` (Google provider), Vitest + Testing Library (existing).

**Scope note:** This is plan 1 of 3 for Spec 1 (Foundation). 1a = Convex + auth swap (this doc). 1b = households/memberships/invites/onboarding gate. 1c = data migration (editors→users, per-recipe state → Convex).

---

## Manual prerequisites (YOU must do these — they can't be automated)

These are interactive and/or require secrets and `.env.local`, which the agent cannot write. Do them before Task 5; Tasks 1–4 can be written first.

1. **Create the Convex project & local env:** run `npx convex dev` once in the repo. Log in when prompted, create/select a project named `cooking-with-june`. This writes `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` into `.env.local` and starts the codegen/dev sync. Leave it running (or re-run) during development.
2. **Bootstrap Convex Auth keys:** run `npx @convex-dev/auth`. This sets `JWT_PRIVATE_KEY`, `JWKS`, and `SITE_URL` env vars **on the Convex deployment** (not local) and may scaffold `convex/auth.ts`, `convex/auth.config.ts`, `convex/http.ts`. If it creates those files, that's fine — Tasks 3–4 give the exact contents to converge to (overwrite to match).
3. **Reuse your existing Google OAuth app:** set its client id/secret as Convex env vars:
   - `npx convex env set AUTH_GOOGLE_ID <your-google-client-id>`
   - `npx convex env set AUTH_GOOGLE_SECRET <your-google-client-secret>`
   - In Google Cloud Console → Credentials → your OAuth client → **Authorized redirect URIs**, add: `https://<your-deployment>.convex.site/api/auth/callback/google` (find `<your-deployment>` in `.env.local`'s `NEXT_PUBLIC_CONVEX_URL`, replacing `.convex.cloud` with `.convex.site`).
4. **Confirm `.env.local`** contains at least:
   ```
   CONVEX_DEPLOYMENT=<written by convex dev>
   NEXT_PUBLIC_CONVEX_URL=https://<deployment>.convex.cloud
   ```

> When these are done, sign-in will route through Convex. Until they're done, Tasks 1–4 (pure code/config) are still safe to write and commit.

---

## File structure

| File | Responsibility |
|---|---|
| `convex/schema.ts` (create) | Convex schema; spreads `authTables` (provides `users`, `authSessions`, etc.) |
| `convex/auth.ts` (create) | Convex Auth config with Google provider |
| `convex/auth.config.ts` (create) | Auth provider domain config for the deployment |
| `convex/http.ts` (create) | Registers Convex Auth HTTP routes |
| `convex/users.ts` (create) | `me` query — current authed user doc or null |
| `src/middleware.ts` (create) | Convex Auth Next.js middleware |
| `src/components/convex-client-provider.tsx` (create) | Client provider wrapping `ConvexAuthNextjsProvider` |
| `src/lib/viewer-map.ts` (create) | Pure `mapEditorToViewer()` — testable bridge logic |
| `src/lib/viewer.ts` (modify) | Re-implement `getViewer`/`requireEditor` on the Convex token; same return shape |
| `src/app/layout.tsx` (modify) | Wrap tree in `ConvexAuthNextjsServerProvider` + client provider |
| `src/components/providers.tsx` (delete) | Replaced by `convex-client-provider.tsx` |
| `src/components/auth-controls.tsx` (modify) | Use `useAuthActions` + `useQuery(api.users.me)` instead of `useSession` |
| `src/auth.ts` (delete) | next-auth instance — removed |
| `src/app/api/auth/[[...nextauth]]/route.ts` (delete) | next-auth route — removed |
| `src/types/next-auth.d.ts` (delete) | next-auth type augmentation — removed |
| `tsconfig.json` (modify) | Add `@cvx/*` path alias → `convex/*` |
| `src/components/auth-controls.test.tsx` (modify) | Update mocks to Convex auth hooks |
| `src/components/site-header.test.tsx` (modify) | Update AuthControls stub |

---

### Task 1: Install Convex dependencies and add the path alias

**Files:**
- Modify: `package.json` (via npm)
- Modify: `tsconfig.json`

- [ ] **Step 1: Install Convex packages**

Run:
```bash
npm install convex @convex-dev/auth @auth/core@0.37.0
```
Expected: packages added to `dependencies`. (`@auth/core` is pinned because `@convex-dev/auth` requires a compatible version.)

- [ ] **Step 2: Add a `@cvx/*` alias for Convex generated code**

In `tsconfig.json`, inside `compilerOptions.paths`, add the `@cvx/*` entry alongside the existing `@/*` mapping. Example merged `paths`:
```jsonc
"paths": {
  "@/*": ["./src/*"],
  "@cvx/*": ["./convex/*"]
}
```
(This lets `src/` files import `@cvx/_generated/api` cleanly. Keep whatever `@/*` value already exists; only add the `@cvx/*` line.)

- [ ] **Step 3: Verify typecheck still passes**

Run:
```bash
npx tsc --noEmit
```
Expected: PASS (no new errors; generated Convex files don't exist yet but nothing imports them).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json tsconfig.json
git commit -m "chore: add convex + convex-auth deps and @cvx path alias"
```

---

### Task 2: Convex schema with auth tables

**Files:**
- Create: `convex/schema.ts`

- [ ] **Step 1: Write the schema**

```typescript
import { defineSchema } from "convex/server";
import { authTables } from "@convex-dev/auth/server";

// authTables provides users, authSessions, authAccounts, etc.
// Spec 1b adds households/memberships/invites; Spec 2 adds pantry/grocery/plan.
export default defineSchema({
  ...authTables,
});
```

- [ ] **Step 2: Generate Convex types**

Run (requires `npx convex dev` running or run once):
```bash
npx convex codegen
```
Expected: `convex/_generated/` is created/updated with `api.d.ts`, `dataModel.d.ts`, etc. No errors.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts convex/_generated
git commit -m "feat: convex schema with auth tables"
```

---

### Task 3: Convex Auth config (Google provider + HTTP routes)

**Files:**
- Create: `convex/auth.ts`
- Create: `convex/auth.config.ts`
- Create: `convex/http.ts`

- [ ] **Step 1: Write the auth config**

`convex/auth.ts`:
```typescript
import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google],
});
```

- [ ] **Step 2: Write the provider domain config**

`convex/auth.config.ts`:
```typescript
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
```

- [ ] **Step 3: Register the auth HTTP routes**

`convex/http.ts`:
```typescript
import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();
auth.addHttpRoutes(http);

export default http;
```

- [ ] **Step 4: Verify codegen picks up the new functions**

Run:
```bash
npx convex codegen
```
Expected: no errors; `convex/_generated/api.d.ts` now references the auth module.

- [ ] **Step 5: Commit**

```bash
git add convex/auth.ts convex/auth.config.ts convex/http.ts convex/_generated
git commit -m "feat: convex auth config with google provider"
```

---

### Task 4: `me` query

**Files:**
- Create: `convex/users.ts`

- [ ] **Step 1: Write the query**

`convex/users.ts`:
```typescript
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Returns the currently authenticated user document, or null.
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return await ctx.db.get(userId);
  },
});
```

- [ ] **Step 2: Regenerate types and verify**

Run:
```bash
npx convex codegen && npx tsc --noEmit
```
Expected: PASS; `api.users.me` is available in generated `api`.

- [ ] **Step 3: Commit**

```bash
git add convex/users.ts convex/_generated
git commit -m "feat: convex users.me query"
```

---

### Task 5: Next.js middleware

**Files:**
- Create: `src/middleware.ts`

> Requires the manual prerequisites to be complete to function at runtime, but the file itself can be written/committed now.

- [ ] **Step 1: Write the middleware**

`src/middleware.ts`:
```typescript
import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";

export default convexAuthNextjsMiddleware();

export const config = {
  // Run on all routes except static assets and Next internals.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

- [ ] **Step 2: Verify build compiles the middleware**

Run:
```bash
npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: convex auth next.js middleware"
```

---

### Task 6: Client + server providers (swap SessionProvider for Convex)

**Files:**
- Create: `src/components/convex-client-provider.tsx`
- Modify: `src/app/layout.tsx`
- Delete: `src/components/providers.tsx`

- [ ] **Step 1: Write the client provider**

`src/components/convex-client-provider.tsx`:
```tsx
"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      {children}
    </ConvexAuthNextjsProvider>
  );
}
```

- [ ] **Step 2: Wrap the root layout**

In `src/app/layout.tsx`: replace the `Providers` import with the new providers, and wrap the tree. Change the import line:
```tsx
// remove: import { Providers } from "@/components/providers";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "@/components/convex-client-provider";
```
Change the `RootLayout` return to:
```tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en" className={`${libreCaslon.variable} ${newsreader.variable}`}>
        <body className="min-h-screen bg-paper font-body text-ink antialiased">
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
```

- [ ] **Step 3: Delete the old provider**

```bash
git rm src/components/providers.tsx
```

- [ ] **Step 4: Verify typecheck**

Run:
```bash
npx tsc --noEmit
```
Expected: PASS. (If `auth-controls.tsx` still imports `next-auth/react`, that's fixed in Task 8 — typecheck may still pass since the package is present until Task 9. If it errors here, proceed to Task 8 before re-running.)

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/components/convex-client-provider.tsx
git commit -m "feat: wrap app in convex auth providers"
```

---

### Task 7: Re-implement the viewer bridge (keep the interface)

**Files:**
- Create: `src/lib/viewer-map.ts`
- Create: `src/lib/viewer-map.test.ts`
- Modify: `src/lib/viewer.ts`

- [ ] **Step 1: Write the failing test for the pure mapper**

`src/lib/viewer-map.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { mapEditorToViewer } from "./viewer-map";

describe("mapEditorToViewer", () => {
  it("treats a resolved editor as an editor", () => {
    const viewer = mapEditorToViewer(
      { _id: "editor-1", name: "Jacob" },
      "Google Name",
    );
    expect(viewer).toEqual({
      isEditor: true,
      editorId: "editor-1",
      name: "Jacob",
    });
  });

  it("treats a null editor as a non-editor and falls back to the auth name", () => {
    const viewer = mapEditorToViewer(null, "Google Name");
    expect(viewer).toEqual({
      isEditor: false,
      editorId: null,
      name: "Google Name",
    });
  });

  it("returns a null name when neither editor nor fallback is present", () => {
    const viewer = mapEditorToViewer(null, null);
    expect(viewer).toEqual({
      isEditor: false,
      editorId: null,
      name: null,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
npx vitest run src/lib/viewer-map.test.ts
```
Expected: FAIL — `Cannot find module './viewer-map'`.

- [ ] **Step 3: Write the pure mapper**

`src/lib/viewer-map.ts`:
```typescript
import type { EditorRecord } from "@/lib/editor-allowlist";

export type Viewer = {
  isEditor: boolean;
  editorId: string | null;
  name: string | null;
};

// Bridge: a signed-in user is an "editor" iff a Sanity editor doc matched their email.
export function mapEditorToViewer(
  editor: EditorRecord | null,
  fallbackName: string | null,
): Viewer {
  return {
    isEditor: editor != null,
    editorId: editor?._id ?? null,
    name: editor?.name ?? fallbackName ?? null,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
npx vitest run src/lib/viewer-map.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 5: Re-implement `viewer.ts` on the Convex token**

Replace the entire contents of `src/lib/viewer.ts` with:
```typescript
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@cvx/_generated/api";
import { getEditorByEmail } from "@/sanity/lib/editors";
import { mapEditorToViewer, type Viewer } from "@/lib/viewer-map";

export type { Viewer };

const ANON: Viewer = { isEditor: false, editorId: null, name: null };

// Server-only: resolve the current viewer. Auth identity comes from Convex;
// "editor" status is bridged to the existing Sanity editor allowlist by email.
export async function getViewer(): Promise<Viewer> {
  const token = await convexAuthNextjsToken();
  if (!token) return ANON;

  const me = await fetchQuery(api.users.me, {}, { token });
  const email = me?.email ?? null;
  if (!email) return { ...ANON, name: me?.name ?? null };

  const editor = await getEditorByEmail(email);
  return mapEditorToViewer(editor, me?.name ?? null);
}

// Throws if the current request is not an authenticated editor.
export async function requireEditor(): Promise<Viewer & { editorId: string }> {
  const viewer = await getViewer();
  if (!viewer.isEditor || !viewer.editorId) {
    throw new Error("Not authorized: editors only");
  }
  return { ...viewer, editorId: viewer.editorId };
}
```

- [ ] **Step 6: Verify typecheck and the mapper test**

Run:
```bash
npx convex codegen && npx tsc --noEmit && npx vitest run src/lib/viewer-map.test.ts
```
Expected: typecheck PASS, mapper test PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/viewer.ts src/lib/viewer-map.ts src/lib/viewer-map.test.ts
git commit -m "feat: bridge getViewer to convex auth, keep editor semantics"
```

---

### Task 8: Update `AuthControls` to Convex auth hooks

**Files:**
- Modify: `src/components/auth-controls.tsx`
- Modify: `src/components/auth-controls.test.tsx`
- Modify: `src/components/site-header.test.tsx`

- [ ] **Step 1: Update the failing component test first**

Replace `src/components/auth-controls.test.tsx` mock setup and assertions to use Convex hooks. Full file:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("@cvx/_generated/api", () => ({ api: { users: { me: "users.me" } } }));

import { useQuery } from "convex/react";
import { AuthControls } from "./auth-controls";

const mockUseQuery = useQuery as ReturnType<typeof vi.fn>;

describe("AuthControls", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
  });

  it("shows Sign in when unauthenticated", () => {
    mockUseQuery.mockReturnValue(null);
    render(<AuthControls />);
    expect(screen.getByText("Sign in")).toBeInTheDocument();
  });

  it("shows Plan + Sign out for an editor", () => {
    mockUseQuery.mockReturnValue({ name: "Jacob", isEditor: true });
    render(<AuthControls />);
    expect(screen.getByText("Plan")).toBeInTheDocument();
    expect(screen.getByText("Sign out")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
npx vitest run src/components/auth-controls.test.tsx
```
Expected: FAIL — current `auth-controls.tsx` still imports `next-auth/react` and reads `useSession`.

- [ ] **Step 3: Rewrite the component**

Note: `api.users.me` returns the raw user doc (no `isEditor`). For the client control we only need name + whether to show the Plan link. Expose an `isEditor` boolean by reading it from a lightweight query in 1b; for now derive the Plan link from "is the user signed in" — editors-only gating still happens server-side on `/plan`. Full `src/components/auth-controls.tsx`:
```tsx
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
```

> Note: `useQuery` returns `undefined` while loading and `null` when unauthenticated — the test mocks `null` (loaded, signed-out) and an object (signed-in). The loading `···` branch is covered by `undefined`, which the test doesn't assert.

- [ ] **Step 4: Update the site-header test stub**

In `src/components/site-header.test.tsx`, replace the `next-auth/react` mock (lines ~10-13) with a stub of `AuthControls` itself (simplest, avoids Convex provider in that test). Change the mock block to:
```tsx
// AuthControls needs Convex providers — stub it to a no-op for header tests.
vi.mock("./auth-controls", () => ({
  AuthControls: () => null,
}));
```
(Remove the old `vi.mock("next-auth/react", ...)` block.)

- [ ] **Step 5: Run the affected tests to verify they pass**

Run:
```bash
npx vitest run src/components/auth-controls.test.tsx src/components/site-header.test.tsx
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/auth-controls.tsx src/components/auth-controls.test.tsx src/components/site-header.test.tsx
git commit -m "feat: auth-controls on convex auth hooks"
```

---

### Task 9: Remove next-auth

**Files:**
- Delete: `src/auth.ts`
- Delete: `src/app/api/auth/[[...nextauth]]/route.ts`
- Delete: `src/types/next-auth.d.ts`
- Modify: `package.json` (uninstall)

- [ ] **Step 1: Delete the next-auth files**

```bash
git rm src/auth.ts "src/app/api/auth/[[...nextauth]]/route.ts" src/types/next-auth.d.ts
```
(If the `src/app/api/auth` directory is now empty, remove it too.)

- [ ] **Step 2: Uninstall next-auth**

```bash
npm uninstall next-auth
```

- [ ] **Step 3: Verify nothing still imports next-auth**

Run:
```bash
grep -rn "next-auth" src ; echo "exit: $?"
```
Expected: no matches (grep exit 1). If any remain, fix them before continuing.

- [ ] **Step 4: Full typecheck, lint, and test suite**

Run:
```bash
npx convex codegen && npx tsc --noEmit && npm run lint && npm test
```
Expected: typecheck PASS, lint PASS, all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove next-auth in favor of convex auth"
```

---

### Task 10: End-to-end verification

**Files:** none (manual verification)

- [ ] **Step 1: Confirm manual prerequisites are done**

Verify `.env.local` has `NEXT_PUBLIC_CONVEX_URL` + `CONVEX_DEPLOYMENT`, and Convex env has `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`:
```bash
npx convex env list
```
Expected: the five auth vars present.

- [ ] **Step 2: Run the app with Convex**

In two terminals:
```bash
npx convex dev    # terminal 1
npm run dev       # terminal 2
```

- [ ] **Step 3: Verify the auth flow**

In the browser:
1. Visit `/` signed out → header shows "Sign in".
2. Click "Sign in" → Google OAuth → returns signed in; header shows your name + "Plan" + "Sign out".
3. As an allowlisted editor (your email matches a Sanity `editor` doc), visit `/plan` → it loads (not redirected).
4. Sign out → header returns to "Sign in"; visiting `/plan` redirects to `/`.

Expected: all four behave as described. (Editor gating still works because `getViewer()` resolves your Convex email against the Sanity editor docs.)

- [ ] **Step 4: Commit any fixups**

```bash
git add -A && git commit -m "fix: auth flow verification fixups" --allow-empty
```

---

## Self-review notes

- **Spec coverage (1a slice):** Convex project ✓ (Tasks 1–4), Convex Auth Google ✓ (Task 3), `users`/`me` ✓ (Tasks 2,4), middleware ✓ (Task 5), providers ✓ (Task 6), viewer bridge keeping editor semantics ✓ (Task 7), client controls ✓ (Task 8), next-auth removal ✓ (Task 9), verification ✓ (Task 10). Households, invites, onboarding gate, and data migration are intentionally **out of scope** here → plans 1b/1c.
- **Bridge rationale:** keeping `getViewer()`'s shape means the 14 consumer references found in `recipe-actions.ts`, `plan-actions.ts`, and the `(site)` pages need **no changes** in 1a.
- **Known follow-up:** `AuthControls` shows the Plan link to any signed-in user (server-side gating still protects `/plan`). 1b adds a proper `isEditor`/household-aware client query so the link only shows when relevant.
```
