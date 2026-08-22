# The Nook

Mobile-first, AI-assisted journal. Start with **[../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)** — it's the source of truth for product intent, data model, encryption design, and sequence diagrams. This README is just the "how do I run it" layer on top.

Visual reference: [Journal App Mobile Flow](https://claude.ai/code/artifact/36d63c97-7c7c-4fd6-8234-b35ea36ed857) (design canvas, `../design/mobile-flow/`).

## Stack

Next.js (App Router, TS) · Tailwind · Clerk (auth) · Supabase (Postgres + RLS) · OpenAI (GPT-4o-mini + Whisper) · Zustand + TanStack Query · Serwist (PWA)

## Setup

```bash
npm install
cp .env.example .env.local   # fill in Clerk / Supabase / OpenAI keys
```

1. Create a Supabase project, then apply `supabase/migrations/0001_init.sql`.
2. In Supabase → Authentication → Sign In / Providers, add Clerk as a third-party auth provider — the RLS policies in that migration key off the Clerk user ID inside the verified JWT (`auth.jwt()->>'sub'`), so this step isn't optional.
3. Once the schema is live, regenerate real types: `npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts` (replaces the placeholder in that file).

```bash
npm run dev
```

## What's scaffolded vs. what's next

**In place:**
- `src/lib/crypto/` — the full client-side envelope-encryption module (Argon2id KEK derivation, DEK wrap/unwrap, AES-256-GCM entry encryption). This was built first and deliberately — it's the piece the whole privacy model depends on.
- `src/lib/store/session.ts` — in-memory-only DEK holder (never persisted; re-derived from the passphrase on every load, by design).
- `src/lib/supabase/` — browser + server clients, RLS-aware via Clerk.
- `src/lib/ai/openai.ts` — server-only; prompt/playback generation and Whisper transcription, built to receive plaintext transiently and never log or persist it.
- `supabase/migrations/0001_init.sql` — schema matching the ERD in the architecture doc.
- `src/proxy.ts` — Clerk auth gate. Named `proxy.ts`, not `middleware.ts`: **this Next.js version (16) renamed the convention** — see `AGENTS.md` and `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` before assuming otherwise.
- `src/app/api/` route handlers for keys, entries, AI playback, and transcription — thin, matching the sequence diagrams in the architecture doc section 6.
- Sage design tokens in `globals.css`, lifted directly from the mockups.

**Not yet built (intentionally left for the next pass, not forgotten):**
- Any actual screen UI beyond the placeholder home page — the 20 screens in the design canvas still need to be built as real components.
- Signup/passphrase-setup flow wiring (Clerk signup → `wrapDataEncryptionKey` → `POST /api/keys`).
- Service worker registration (Serwist is installed, not yet configured) and Web Push subscription flow.
- Vercel Cron config for the daily reminder.
- App icons (`public/manifest.json` currently has an empty `icons` array).
- Everything flagged as an open question in `docs/ARCHITECTURE.md` §8 (notification content richness, multi-device key handling, data export/deletion, offline conflict handling).

## A rule worth keeping visible

`src/lib/crypto/` and anything holding the unwrapped DEK must never run server-side, and `src/lib/ai/openai.ts` must never log or persist the plaintext it's handed. Both are load-bearing for the privacy claim this whole product makes — see `docs/ARCHITECTURE.md` §5.
