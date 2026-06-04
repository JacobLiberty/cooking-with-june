# Cooking with June 🐱🍳

A warm, editorial, homemade-but-painstakingly-crafted digital cookbook for Jacob &
Lily — and June, the brown tabby cat who supervises. Built with Next.js and Sanity,
deployed on Vercel.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm start` — run the production build
- `npm run lint` — lint
- `npm test` — run the test suite (Vitest)
- `npm run test:watch` — Vitest in watch mode

## Project docs

- Design spec: `docs/superpowers/specs/2026-05-29-cooking-with-june-design.md`
- Implementation plans: `docs/superpowers/plans/`

## Environment

Copy `.env.example` to `.env.local` and fill in values as later phases add them
(Sanity, auth). Phase 1 needs no environment variables.

## Authentication (Phase 5)

Sign-in is restricted to editors managed as `editor` documents in `/studio`.
Jacob is already seeded as the first editor.

Add to `.env.local` (never commit these):

```
AUTH_SECRET=<generate: npx auth secret or openssl rand -base64 33>
AUTH_GOOGLE_ID=<Google OAuth client id>
AUTH_GOOGLE_SECRET=<Google OAuth client secret>
```

Create a Google OAuth 2.0 Client in Google Cloud Console (APIs and Services >
Credentials > OAuth client ID > Web application) with authorized redirect URIs:

- `http://localhost:3000/api/auth/callback/google`
- `https://<your-vercel-domain>/api/auth/callback/google`

Auth secrets are not required for build or tests — only for runtime sign-in.
