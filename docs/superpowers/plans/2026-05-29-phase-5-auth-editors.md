# Cooking with June — Phase 5: Auth + Editor Allowlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or executing-plans. Checkbox steps; TDD where marked.

**Goal:** Add Google sign-in (Auth.js v5) restricted to a Sanity-managed editor allowlist, expose whether the current viewer is an editor (for gating edits in Phase 6), and show a tasteful sign-in / sign-out control in the header — without making the public pages dynamic.

**Architecture:** Auth.js v5 config in `src/auth.ts` (`{ handlers, auth, signIn, signOut }`), Google provider via `AUTH_GOOGLE_ID/SECRET` env inference, JWT sessions. The `signIn` callback **only allows emails present in a Sanity `editor` document** (so only Jacob/Lily/invited friends can authenticate); `jwt`/`session` callbacks attach `editorId`/editor name. Public pages stay static/ISR — the header's auth state is a small client island using `useSession` (via a `SessionProvider`), so reading the session never forces server rendering of content pages. Server-side, `auth()` + a `requireEditor()` helper will gate writes in Phase 6.

**Tech Stack:** `next-auth@5` (Auth.js v5), Next.js 16 App Router, next-sanity, Vitest.

**Design contract:** `design.md` — the auth control is a quiet small-caps kicker ("Sign in" / the editor's name + "Sign out"), heather on hover; no emoji.

## SECURITY NOTE (surface in review + to the user)
The editor allowlist lives in the **public** Sanity dataset, so `editor` documents — including emails — are technically queryable via the public API by someone who knows the project ID. We never select or render `editor.email` in any shipped query/UI (ratings show `editor->name` only). For a personal app with shared gmail addresses this is low risk, but it is a real PII exposure. Hardening options (documented, user's call): move the `editor` type to a private dataset, or use a server-only env allowlist (trades away no-redeploy editor management). Default for v1: keep Sanity-managed (honors the approved design); flag for decision.

## MANUAL SETUP REQUIRED (user — cannot be automated)
Add to `.env.local` (secrets — never committed):
```
AUTH_SECRET=<generate: `npx auth secret` or `openssl rand -base64 33`>
AUTH_GOOGLE_ID=<Google OAuth client id>
AUTH_GOOGLE_SECRET=<Google OAuth client secret>
```
Create a Google OAuth 2.0 Client (Google Cloud Console → APIs & Services → Credentials → OAuth client ID → Web application) with authorized redirect URIs:
- `http://localhost:3000/api/auth/callback/google`
- `https://<your-vercel-domain>/api/auth/callback/google`
Sign-in can't be runtime-tested without these; the build/tests do not require them.

## Conventions
- App code uses `@/`. Don't touch `src/sanity/env.ts`, `sanity.config.ts`, `sanity.cli.ts`, `.env*`.

## File Structure
Created:
- `src/auth.ts` — Auth.js v5 config + exports
- `src/app/api/auth/[[...nextauth]]/route.ts` — re-export handlers
- `src/types/next-auth.d.ts` — session/jwt type augmentation
- `src/sanity/lib/editors.ts` — `getEditorByEmail()` (server query)
- `src/lib/editor-allowlist.ts` + `.test.ts` — pure `findEditorByEmail()` (TDD)
- `src/lib/viewer.ts` — `getViewer()` / `requireEditor()` server helpers
- `src/components/providers.tsx` — client `SessionProvider`
- `src/components/auth-controls.tsx` — client sign-in/out island
Modified:
- `src/app/layout.tsx` — wrap children in `<Providers>`
- `src/components/site-header.tsx` — render `<AuthControls/>`
- `README.md` — document the auth env vars + Google setup

---

## Task 1: Install Auth.js v5
- [ ] **Step 1:** `npm install next-auth@beta`  (Auth.js v5)
- [ ] **Step 2:** Confirm: `node -e "console.log(require('./package.json').dependencies['next-auth'])"` prints a `5.x`/`^5`/beta version. If install reports React 19 peer issues, capture exact text; only use a flag if it hard-fails (report it).
- [ ] **Step 3:** Commit: `git add package.json package-lock.json && git commit -m "chore: add Auth.js v5 (next-auth beta)"`

---

## Task 2: Pure editor-allowlist matcher (TDD)

- [ ] **Step 1: Test `src/lib/editor-allowlist.test.ts`**
```ts
import { describe, it, expect } from "vitest";
import { normalizeEmail, findEditorByEmail } from "@/lib/editor-allowlist";

const editors = [
  { _id: "e1", name: "Jacob", email: "jacob.tobin.liberty@gmail.com" },
  { _id: "e2", name: "Lily", email: "Lily@example.com" },
];

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Jacob@GMAIL.com ")).toBe("jacob@gmail.com");
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(undefined)).toBe("");
  });
});

describe("findEditorByEmail", () => {
  it("matches case-insensitively", () => {
    expect(findEditorByEmail(editors, "JACOB.TOBIN.LIBERTY@gmail.com")?.name).toBe("Jacob");
    expect(findEditorByEmail(editors, "lily@example.com")?.name).toBe("Lily");
  });
  it("returns null for non-editors or empty input", () => {
    expect(findEditorByEmail(editors, "stranger@example.com")).toBeNull();
    expect(findEditorByEmail(editors, "")).toBeNull();
    expect(findEditorByEmail(editors, null)).toBeNull();
  });
});
```
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3: Implement `src/lib/editor-allowlist.ts`**
```ts
export type EditorRecord = { _id: string; name: string; email: string };

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function findEditorByEmail(
  editors: EditorRecord[],
  email: string | null | undefined,
): EditorRecord | null {
  const target = normalizeEmail(email);
  if (!target) return null;
  return editors.find((e) => normalizeEmail(e.email) === target) ?? null;
}
```
- [ ] **Step 4:** Run — PASS. Commit: `git add src/lib/editor-allowlist.ts src/lib/editor-allowlist.test.ts && git commit -m "feat: pure editor-allowlist matcher"`

---

## Task 3: Server-side editor lookup

- [ ] **Step 1: `src/sanity/lib/editors.ts`**
```ts
import { defineQuery } from "next-sanity";
import { client } from "@/sanity/lib/client";
import {
  findEditorByEmail,
  normalizeEmail,
  type EditorRecord,
} from "@/lib/editor-allowlist";

const EDITORS_QUERY = defineQuery(`
  *[_type == "editor" && defined(email)]{ _id, name, email }
`);

// Server-only: resolve the editor doc for a signed-in email, or null.
export async function getEditorByEmail(
  email: string | null | undefined,
): Promise<EditorRecord | null> {
  if (!normalizeEmail(email)) return null;
  const editors = await client
    .withConfig({ useCdn: false })
    .fetch<EditorRecord[]>(EDITORS_QUERY);
  return findEditorByEmail(editors, email);
}
```

- [ ] **Step 2:** `npx tsc --noEmit` clean. Commit: `git add src/sanity/lib/editors.ts && git commit -m "feat: server-side editor lookup by email"`

---

## Task 4: Auth.js v5 config + route + types

- [ ] **Step 1: `src/auth.ts`**
```ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getEditorByEmail } from "@/sanity/lib/editors";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  trustHost: true,
  callbacks: {
    // Only allowlisted editors may sign in at all.
    async signIn({ user }) {
      const editor = await getEditorByEmail(user.email);
      return editor != null;
    },
    async jwt({ token }) {
      // Resolve editor identity once, on first sign-in (when name/email present).
      if (token.email && token.editorId === undefined) {
        const editor = await getEditorByEmail(token.email);
        token.editorId = editor?._id ?? null;
        token.editorName = editor?.name ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.editorId = (token.editorId as string | null) ?? null;
      session.user.isEditor = Boolean(token.editorId);
      if (token.editorName) session.user.name = token.editorName as string;
      return session;
    },
  },
});
```

- [ ] **Step 2: `src/types/next-auth.d.ts`**
```ts
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      editorId: string | null;
      isEditor: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    editorId?: string | null;
    editorName?: string | null;
  }
}
```

- [ ] **Step 3: `src/app/api/auth/[[...nextauth]]/route.ts`**
```ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 4:** `npx tsc --noEmit` clean. Build (no creds needed): `NEXT_PUBLIC_SANITY_PROJECT_ID=zwjctldy NEXT_PUBLIC_SANITY_DATASET=production npm run build` — must compile; the auth route appears as a dynamic `ƒ` route. If the build fails because `AUTH_SECRET` is required at build, report it (it should not be — auth routes are dynamic).
- [ ] **Step 5:** Commit: `git add src/auth.ts src/types/next-auth.d.ts "src/app/api/auth" && git commit -m "feat: Auth.js v5 config, route, and session types (editor-gated sign-in)"`

---

## Task 5: Viewer helpers (server)

- [ ] **Step 1: `src/lib/viewer.ts`**
```ts
import { auth } from "@/auth";

export type Viewer = {
  isEditor: boolean;
  editorId: string | null;
  name: string | null;
};

export async function getViewer(): Promise<Viewer> {
  const session = await auth();
  return {
    isEditor: session?.user?.isEditor ?? false,
    editorId: session?.user?.editorId ?? null,
    name: session?.user?.name ?? null,
  };
}

/** Throws if the current request is not an authenticated editor. (Used in Phase 6.) */
export async function requireEditor(): Promise<Viewer & { editorId: string }> {
  const viewer = await getViewer();
  if (!viewer.isEditor || !viewer.editorId) {
    throw new Error("Not authorized: editors only");
  }
  return { ...viewer, editorId: viewer.editorId };
}
```
- [ ] **Step 2:** `npx tsc --noEmit` clean. Commit: `git add src/lib/viewer.ts && git commit -m "feat: server viewer + requireEditor helpers"`

---

## Task 6: SessionProvider + AuthControls + header wiring

- [ ] **Step 1: `src/components/providers.tsx`**
```tsx
"use client";

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

- [ ] **Step 2: `src/components/auth-controls.tsx`**
```tsx
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
```

- [ ] **Step 3: Wrap children in `src/app/layout.tsx`** — add the import and wrap the body's `{children}`:
```tsx
import { Providers } from "@/components/providers";
// ...
      <body className="min-h-screen bg-paper font-body text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
```
(Keep the fonts/metadata exactly as they are.)

- [ ] **Step 4: Add `<AuthControls/>` to `src/components/site-header.tsx`** — import it and place it after the `<nav>`:
```tsx
import { AuthControls } from "@/components/auth-controls";
// ...
        <nav aria-label="Primary" className="flex items-center gap-7">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
          <AuthControls />
        </nav>
```
(`AuthControls` is a client island; `SiteHeader` stays a server component — a client child is fine.)

- [ ] **Step 5: Verify** `npm test` (prior 38 + editor-allowlist 4 = 42), env-prefixed `npm run build` (compiles; `/` stays static/ISR; auth route dynamic), `npm run lint`, `npx tsc --noEmit`. Commit: `git add src/components/providers.tsx src/components/auth-controls.tsx src/app/layout.tsx src/components/site-header.tsx && git commit -m "feat: header sign-in/out control via SessionProvider"`

---

## Task 7: Document env in README
- [ ] **Step 1:** Add an "Authentication (Phase 5)" section to `README.md` listing the three `AUTH_*` env vars and the Google OAuth redirect URIs (from MANUAL SETUP above). Note editors are managed as `editor` documents in `/studio`.
- [ ] **Step 2:** Commit: `git add README.md && git commit -m "docs: document auth env vars and Google OAuth setup"`

---

## Task 8: Phase gate
- [ ] `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm audit` (expect 0), env-prefixed `npm run build`. Report. Note: the live Google sign-in flow requires the user's OAuth creds and cannot be smoke-tested here.

---

## Self-Review
**Spec coverage (Auth.js + Google, Sanity editor allowlist, bootstrap first editor [Jacob already seeded], gated sign-in):** sign-in restricted to allowlist (signIn callback + getEditorByEmail) ✓; session exposes isEditor/editorId (jwt+session callbacks + type augmentation) ✓; header control ✓; server `requireEditor()` ready for Phase 6 ✓.
**Design.md:** auth control is a quiet kicker, heather hover, no emoji.
**Security:** sign-in denied for non-editors; secrets only in env (AUTH_*); editor emails never selected/rendered in shipped queries (only name); public-dataset email exposure flagged for the user's decision. AUTH_SECRET required at runtime, not committed.
**Placeholders:** none.
**Type consistency:** `EditorRecord` defined in `editor-allowlist.ts`, reused by `editors.ts`; session augmentation matches what `session` callback sets and what `viewer.ts`/`auth-controls.tsx` read.
**Risks:** (1) next-auth@beta + Next 16/React 19 peer compatibility — verify at install/build, report if broken. (2) Auth.js v5 env inference expects `AUTH_GOOGLE_ID/SECRET` (not GOOGLE_*). (3) `useSession` island keeps content pages static; if the header were made to call `auth()` directly it would force them dynamic — do NOT do that.
