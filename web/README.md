# The Nook

Mobile-first, AI-assisted journal. Start with **[../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)** — it's the source of truth for product intent, data model, encryption design, and sequence diagrams. This README is just the "how do I run it" layer on top.

Visual reference: [Journal App Mobile Flow](https://claude.ai/code/artifact/36d63c97-7c7c-4fd6-8234-b35ea36ed857) (design canvas, `../design/mobile-flow/`).

## Stack

Next.js (App Router, TS) · Tailwind · Clerk (auth) · Supabase (Postgres + RLS) · OpenAI (GPT-4o-mini + Whisper) · Zustand + TanStack Query · Serwist (PWA, installed but not yet wired) · `qrcode` (device-sync QR generation) · Vitest (unit tests)

## Setup

Node version is pinned in `.nvmrc` (22.20.0) — `nvm use` before anything else if
you have nvm; Next.js 16 and Vitest 4 both need Node ≥20, but this repo has been
built and verified against 22.20.0 specifically.

```bash
nvm use                      # or manually match the version in .nvmrc
npm install
cp .env.example .env.local   # fill in Clerk / Supabase / OpenAI keys
```

1. Create a Supabase project, then apply the migrations in `supabase/migrations/` **in order** (`0001_init.sql`, `0002_ciphertext_as_text.sql`, `0003_device_sync.sql`, `0004_prompt_cache.sql`, `0005_ai_usage_log.sql`) — either paste each into the SQL Editor, or `psql`/the Supabase CLI against your connection string.
2. In Supabase → Authentication → Sign In / Providers, add Clerk as a third-party auth provider — the RLS policies key off the Clerk user ID inside the verified JWT (`auth.jwt()->>'sub'`), so this step isn't optional.

`src/lib/supabase/types.ts` is already checked in with real generated types (`supabase gen types typescript --local`, against a local Docker Postgres built by replaying the migrations above — see the file's own header). Regenerate it after any new migration, or once you've `supabase link`ed this repo to your own hosted project, with:

```bash
npx supabase@2.115.0 gen types typescript --linked > src/lib/supabase/types.ts   # against your linked project
# or, with no login/linking at all — supabase/config.toml is already checked in:
npx supabase@2.115.0 start   # needs Docker running
npx supabase@2.115.0 gen types typescript --local > src/lib/supabase/types.ts
npx supabase@2.115.0 stop
```

```bash
npm run dev
```

## Testing

```bash
npm test
```

`src/lib/crypto/index.test.ts` (Vitest, "node" environment — Node 22's global
WebCrypto covers everything this needs without a jsdom shim) is the only suite so
far: encrypt/decrypt round-trip, DEK wrap/unwrap under both the passphrase and the
recovery-code path, and that tampered ciphertext / wrong key / wrong passphrase /
wrong salt all actually fail rather than silently succeeding.

## CI

`.github/workflows/app-ci.yml` runs on every push/PR to `main`: typecheck
(`npm run typecheck` — runs `next typegen` first, since a bare `tsc --noEmit`
needs the route types a build or `next typegen` generates), lint, `npm test`,
then `npm run build`. The build step needs *some* value for `OPENAI_API_KEY`
(`src/lib/ai/openai.ts` constructs an `OpenAI` client at module scope, so a
missing key throws during page-data collection for the `/api/ai/*` routes) — CI
supplies a placeholder, since no real key is needed to build, only to actually
call OpenAI at request time. Clerk/Supabase keys are not required to build at all.

## What's built

Every screen in the design canvas is wired to real data — Clerk auth, Supabase, and client-side encryption throughout, not mocked:

- **Auth & unlock** (`src/proxy.ts`, `src/components/unlock/`) — Clerk sign-in/up, first-time journal-passphrase setup with a one-time recovery code, returning-device unlock (passphrase or recovery-code fallback), and **multi-device sync**: an already-unlocked device can hand the DEK to a new one via a QR code, encrypted under a channel key the server never sees.
- **Home** (`src/app/(app)/page.tsx`) — greeting, real streak (consecutive-day calculation), AI daily prompt in the user's chosen tone, mood check-in, decrypted recent-entry snippets.
- **Entry composer** (`src/app/(app)/write/`) — text or voice (MediaRecorder + a real reactive waveform, Whisper transcription on "Done" — batch, not live-streaming; see the note in `VoiceRecorder.tsx`), mood, tags, client-side encryption before save, and a DEK-encrypted IndexedDB draft that autosaves on a debounce, flushes immediately on `visibilitychange`, and restores on reopen (`src/lib/hooks/useComposerDraft.ts`) — so a dropped connection, refresh, or backgrounded tab doesn't lose an in-progress entry.
- **Journal list & entry detail** (`src/app/(app)/journal/`) — month-grouped list with search over decrypted content, full-text reader, a real "one year ago today" memory note (found from actual entry dates, not decorative), delete.
- **Playback** (`src/app/(app)/playback/`) — week/month/year stats from real mood/tag data, an AI-generated story recap (mood trend, a verbatim highlight quote, a "letter from your past self," and a then-vs-now comparison that only appears when a genuine cross-time pair of entries actually exists), cached client-side (`src/lib/playback/narrativeCache.ts`) so replaying the same period doesn't re-call the AI — same encrypt-before-storing posture as Smart Search's vector cache.
- **Manifestations** (`src/app/(app)/manifestations/`) — CRUD with category/cadence/auto-detect, and **automatic signal detection**: after each entry saves, it's classified against your active manifestations in the background and matches get recorded — conservatively, so the signal count means something.
- **Settings** (`src/app/(app)/settings/`) — AI tone (stored in Clerk's `unsafeMetadata`, used everywhere prompts are generated), privacy/encryption info, passphrase change, notification preferences (wired to the schema), data export (client-side decrypt + JSON download), full account deletion (Supabase data + Clerk account, in that order), Clerk's account management UI.
- **Smart Search** (`src/app/(app)/search/`, `src/lib/search/`) — opt-in semantic search over your journal, entirely client-side: entries are embedded on-device (`Xenova/all-MiniLM-L12-v2`, in a Web Worker) and the resulting vectors are encrypted with the DEK before being cached in IndexedDB. No server round trip, no OpenAI call — see `docs/ARCHITECTURE.md` §10.3/§10.4 and the quality spike at `docs/spikes/embedding-quality/`.

## Known gaps (flagged deliberately, not forgotten)

- **PWA not fully wired** — Serwist is installed but no service worker is registered yet, so there's no offline app-shell caching and no Web Push subscription flow. The app works as a normal web app today, not yet an installable/offline one.
- **Vercel Cron for the daily reminder** isn't configured — `notification_prefs` stores the preference, nothing triggers the push yet.
- **Notification content richness vs. lock-screen privacy** — still an open product decision (generic push text vs. the richer previews in the original mockup).
- **Live-streaming voice transcription** — deliberately not built. Batch transcription (record → Whisper on "Done") was judged good enough; true live transcription would need OpenAI's Realtime API, a materially bigger swap.

## A rule worth keeping visible

`src/lib/crypto/` and anything holding the unwrapped DEK must never run server-side, and `src/lib/ai/openai.ts` must never log or persist the plaintext it's handed. Both are load-bearing for the privacy claim this whole product makes — see `docs/ARCHITECTURE.md` §5.
