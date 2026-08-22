# The Nook

Mobile-first, AI-assisted journal. Start with **[../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)** — it's the source of truth for product intent, data model, encryption design, and sequence diagrams. This README is just the "how do I run it" layer on top.

Visual reference: [Journal App Mobile Flow](https://claude.ai/code/artifact/36d63c97-7c7c-4fd6-8234-b35ea36ed857) (design canvas, `../design/mobile-flow/`).

## Stack

Next.js (App Router, TS) · Tailwind · Clerk (auth) · Supabase (Postgres + RLS) · OpenAI (GPT-4o-mini + Whisper) · Zustand + TanStack Query · Serwist (PWA, installed but not yet wired) · `qrcode` (device-sync QR generation)

## Setup

```bash
npm install
cp .env.example .env.local   # fill in Clerk / Supabase / OpenAI keys
```

1. Create a Supabase project, then apply the migrations in `supabase/migrations/` **in order** (`0001_init.sql`, `0002_ciphertext_as_text.sql`, `0003_device_sync.sql`) — either paste each into the SQL Editor, or `psql`/the Supabase CLI against your connection string.
2. In Supabase → Authentication → Sign In / Providers, add Clerk as a third-party auth provider — the RLS policies key off the Clerk user ID inside the verified JWT (`auth.jwt()->>'sub'`), so this step isn't optional.
3. Once the schema is live, regenerate real types: `npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts` (replaces the placeholder in that file — needs Docker running locally for `supabase gen types`, which wasn't available when this was scaffolded, so the loose placeholder is still what's in the tree).

```bash
npm run dev
```

## What's built

Every screen in the design canvas is wired to real data — Clerk auth, Supabase, and client-side encryption throughout, not mocked:

- **Auth & unlock** (`src/proxy.ts`, `src/components/unlock/`) — Clerk sign-in/up, first-time journal-passphrase setup with a one-time recovery code, returning-device unlock (passphrase or recovery-code fallback), and **multi-device sync**: an already-unlocked device can hand the DEK to a new one via a QR code, encrypted under a channel key the server never sees.
- **Home** (`src/app/(app)/page.tsx`) — greeting, real streak (consecutive-day calculation), AI daily prompt in the user's chosen tone, mood check-in, decrypted recent-entry snippets.
- **Entry composer** (`src/app/(app)/write/`) — text or voice (MediaRecorder + a real reactive waveform, Whisper transcription on "Done" — batch, not live-streaming; see the note in `VoiceRecorder.tsx`), mood, tags, client-side encryption before save.
- **Journal list & entry detail** (`src/app/(app)/journal/`) — month-grouped list with search over decrypted content, full-text reader, a real "one year ago today" memory note (found from actual entry dates, not decorative), delete.
- **Playback** (`src/app/(app)/playback/`) — week/month/year stats from real mood/tag data, an AI-generated story recap (mood trend, a verbatim highlight quote, a "letter from your past self," and a then-vs-now comparison that only appears when a genuine cross-time pair of entries actually exists).
- **Manifestations** (`src/app/(app)/manifestations/`) — CRUD with category/cadence/auto-detect, and **automatic signal detection**: after each entry saves, it's classified against your active manifestations in the background and matches get recorded — conservatively, so the signal count means something.
- **Settings** (`src/app/(app)/settings/`) — AI tone (stored in Clerk's `unsafeMetadata`, used everywhere prompts are generated), privacy/encryption info, passphrase change, notification preferences (wired to the schema), data export (client-side decrypt + JSON download), full account deletion (Supabase data + Clerk account, in that order), Clerk's account management UI.

## Known gaps (flagged deliberately, not forgotten)

- **PWA not fully wired** — Serwist is installed but no service worker is registered yet, so there's no offline app-shell caching and no Web Push subscription flow. The app works as a normal web app today, not yet an installable/offline one.
- **Vercel Cron for the daily reminder** isn't configured — `notification_prefs` stores the preference, nothing triggers the push yet.
- **Notification content richness vs. lock-screen privacy** — still an open product decision (generic push text vs. the richer previews in the original mockup).
- **Offline draft handling** — the composer holds its text in plain React state; a dropped connection or refresh mid-entry loses it. The architecture doc's IndexedDB draft-cache idea isn't implemented.
- **Live-streaming voice transcription** — deliberately not built. Batch transcription (record → Whisper on "Done") was judged good enough; true live transcription would need OpenAI's Realtime API, a materially bigger swap.

## A rule worth keeping visible

`src/lib/crypto/` and anything holding the unwrapped DEK must never run server-side, and `src/lib/ai/openai.ts` must never log or persist the plaintext it's handed. Both are load-bearing for the privacy claim this whole product makes — see `docs/ARCHITECTURE.md` §5.
