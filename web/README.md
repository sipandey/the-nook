# The Nook

Mobile-first, AI-assisted journal. Start with **[../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)** — it's the source of truth for product intent, data model, encryption design, and sequence diagrams. This README is just the "how do I run it" layer on top.

Visual reference: [Journal App Mobile Flow](https://claude.ai/code/artifact/36d63c97-7c7c-4fd6-8234-b35ea36ed857) (design canvas, `../design/mobile-flow/`).

## Stack

Next.js (App Router, TS) · Tailwind · Clerk (auth) · Supabase (Postgres + RLS) · OpenAI (GPT-4o-mini + Whisper) · Zustand + TanStack Query · Serwist (PWA + service worker, registered) · `web-push` (VAPID push notifications) · Vercel Cron (daily reminder) · `qrcode` (device-sync QR generation) · Vitest (unit tests)

## Setup

Node version is pinned in `.nvmrc` (22.20.0) — `nvm use` before anything else if
you have nvm; Next.js 16 and Vitest 4 both need Node ≥20, but this repo has been
built and verified against 22.20.0 specifically.

```bash
nvm use                      # or manually match the version in .nvmrc
npm install
cp .env.example .env.local   # fill in Clerk / Supabase / OpenAI keys
```

1. Create a Supabase project, then apply the migrations in `supabase/migrations/` **in order** (`0001` through `0008` — see the directory for the full, current list) — either paste each into the SQL Editor, or `psql`/the Supabase CLI against your connection string.
2. In Supabase → Authentication → Sign In / Providers, add Clerk as a third-party auth provider — the RLS policies key off the Clerk user ID inside the verified JWT (`auth.jwt()->>'sub'`), so this step isn't optional.
3. For the daily-reminder cron (`src/app/api/cron/daily-reminder/route.ts`), fill in three more `.env.local` values: `SUPABASE_SERVICE_ROLE_KEY` (Settings → API in the Supabase dashboard — the cron route has no per-request user session to scope a normal client to, so it's the one place in the app that uses this instead of the RLS-scoped client), `NEXT_PUBLIC_VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` (`npx web-push generate-vapid-keys`), and `CRON_SECRET` (any random string ≥16 characters — set the same value in Vercel's project settings so Vercel's own cron invocations authenticate correctly; see [`.env.example`](.env.example)).

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
- **Entry composer** (`src/app/(app)/write/`) — text or voice (MediaRecorder + a real reactive waveform, Whisper transcription on "Done" — batch, not live-streaming; see the note in `VoiceRecorder.tsx`), mood, tags, client-side encryption before save, and a DEK-encrypted IndexedDB draft that autosaves on a debounce, flushes immediately on `visibilitychange`, and restores on reopen (`src/lib/hooks/useComposerDraft.ts`) — so a dropped connection, refresh, or backgrounded tab doesn't lose an in-progress entry. Also supports appending to today's own entry instead of always starting a new one (auto-detected on Home, or via `?entryId=` from the entry-detail page's "Add to this entry" link) — old text stays read-only, new text is appended with a blank-line separator, mood replaces and tags merge; server-enforced today-only via `PATCH /api/entries/[id]` (`src/lib/hooks/useAppendToEntry.ts`, `src/lib/todaysEntry.ts`).
- **Journal list & entry detail** (`src/app/(app)/journal/`) — month-grouped list with search over decrypted content, full-text reader, a real "one year ago today" memory note (found from actual entry dates, not decorative), delete.
- **Playback** (`src/app/(app)/playback/`) — week/month/year stats from real mood/tag data, an AI-generated story recap (mood trend, a verbatim highlight quote, a "letter from your past self," and a then-vs-now comparison that only appears when a genuine cross-time pair of entries actually exists), cached client-side (`src/lib/playback/narrativeCache.ts`) so replaying the same period doesn't re-call the AI — same encrypt-before-storing posture as Smart Search's vector cache.
- **Manifestations** (`src/app/(app)/manifestations/`) — CRUD with category/cadence/auto-detect, and **automatic signal detection**: after each entry saves, it's classified against your active manifestations in the background and matches get recorded — conservatively, so the signal count means something.
- **Settings** (`src/app/(app)/settings/`) — AI tone (stored in Clerk's `unsafeMetadata`, used everywhere prompts are generated), a Privacy & Security section with a real off switch for all AI features (`src/lib/hooks/useAiEnabled.ts`, same Clerk-metadata storage as tone; enforced client-side before each `/api/ai/*` call, not just server-side, since the plaintext exposure it prevents happens on send — see `docs/ARCHITECTURE.md` §6.5) plus links to the encryption/privacy/about pages and a manual "Lock now" control, passphrase change, notification preferences (wired to the schema), data export (client-side decrypt + JSON download), full account deletion (Supabase data + Clerk account, in that order), Clerk's account management UI. The journal also auto-locks itself after a minute continuously backgrounded (`src/lib/hooks/useAutoLock.ts`) — see `docs/ARCHITECTURE.md` §5/§6.2.
- **Smart Search** (`src/app/(app)/search/`, `src/lib/search/`) — opt-in semantic search over your journal, entirely client-side: entries are embedded on-device (`Xenova/all-MiniLM-L12-v2`, in a Web Worker) and the resulting vectors are encrypted with the DEK before being cached in IndexedDB. No server round trip, no OpenAI call — see `docs/ARCHITECTURE.md` §10.3/§10.4 and the quality spike at `docs/spikes/embedding-quality/`.
- **PWA & push notifications** (`src/app/sw.ts`, `src/app/serwist/`, `src/lib/hooks/usePushSubscription.ts`, `src/app/api/cron/daily-reminder/`) — service worker registered site-wide with app-shell caching and an on-brand `/~offline` fallback (confirmed live: server killed, a previously-visited page stayed available, a never-visited one fell back correctly); Web Push subscribe/unsubscribe wired into onboarding and Settings; a Vercel Cron job sends the daily reminder once a day, idempotently, to every device a user has subscribed on. Notification bodies are always generic, decided deliberately — see `docs/ARCHITECTURE.md` §8.
- **Production error monitoring** (`@sentry/nextjs`, `src/lib/monitoring/`) — app-wide, active only in real production. The data-collection policy is the actual point: every category Sentry could otherwise collect by default (stack-frame local variables, cookies, headers, request/response bodies, query params) is explicitly turned off in `sentryOptions.ts`, console breadcrumbs are dropped outright, and Session Replay is never installed at all — see `docs/ARCHITECTURE.md` §8 and the design doc it links for the full reasoning, including a real finding mid-implementation (`sendDefaultPii` alone doesn't cover this in the installed SDK version) that changed the config from what was first approved.

## Known gaps (flagged deliberately, not forgotten)

- **Live-streaming voice transcription** — deliberately not built. Batch transcription (record → Whisper on "Done") was judged good enough; true live transcription would need OpenAI's Realtime API, a materially bigger swap.
- **Live push delivery to a real device is unverified** — the subscribe flow and the cron send route are both built and independently verified (real network round-trips, no mocks), but granting notification permission needs a genuine human click; no browser automation, in any browser, can satisfy that gate by design. One click closes this out.
- **The daily reminder ignores each user's chosen `daily_prompt_time`** — it sends to everyone at one fixed UTC time instead. Vercel's Hobby plan only allows cron jobs to run once per day (confirmed against Vercel's current docs), which makes true per-user scheduling impossible without a paid plan — a stated tradeoff, not an oversight.
- **Playback-ready and manifestation-resurfaced notifications have no send trigger** — their toggles exist in `notification_prefs`/Settings, but nothing sends a push for either type yet. The daily-reminder cron is scoped to exactly that: the daily reminder.
- **Sentry has no `authToken`/org/project configured**, so it can't upload source maps — captured errors reach the dashboard with minified stack traces, not readable ones. Deliberately deferred, not required for error capture itself to work: needs a Sentry auth token the account owner would generate.
- **A live send to Sentry's real servers wasn't directly observed during implementation** — the capture mechanism, the data-collection config, and real network connectivity to Sentry's ingest endpoint were each independently verified, but the SDK's own internal transport call itself wasn't caught by this session's network monitoring within the test window (methodology limits, not a known defect — see `.agent-room/decisions.md`'s NK-06 entry for what was and wasn't confirmed). Worth a first real look at the Sentry dashboard after this ships to confirm events are actually landing.

## A rule worth keeping visible

`src/lib/crypto/` and anything holding the unwrapped DEK must never run server-side, and `src/lib/ai/openai.ts` must never log or persist the plaintext it's handed. Both are load-bearing for the privacy claim this whole product makes — see `docs/ARCHITECTURE.md` §5.
