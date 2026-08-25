# Production Error Monitoring (Sentry) — Design

## Problem

NK-06 (`docs/ROADMAP.md`) is the last unchecked blocker in the launch-ready
checklist: there is zero production error visibility today. A crash in
the unlock flow or in decryption is completely silent — nobody finds out
unless a user reports it, and journaling apps don't get many bug reports
from people whose entries just silently failed to save.

The roadmap entry itself already states the core constraint: **"Must
exclude entry content from payloads."** This is the entire design
problem. The Nook's whole product claim — the thing `content/encryption.md`
stakes its credibility on — is that plaintext never leaves the device.
Sentry's *defaults* are broadly safe (`sendDefaultPii` defaults to
`false`; Session Replay is opt-in, not automatic), verified directly
against Sentry's current docs rather than assumed, but "the defaults are
fine" isn't the same bar as "we made this a checkable, deliberate claim."
This design is about the latter.

## Vendor and access

Sentry, per explicit user choice. A real DSN was provided directly (not
fabricated, not a placeholder) — treated as a config value: stored as an
environment variable, never hardcoded into source, never repeated more
than necessary. DSNs aren't secret in Sentry's own security model (safe
to ship client-side), but it's still project-specific and handled the
same deliberate way this repo already handles every other credential
(`OPENAI_API_KEY`, Supabase keys, etc.) — via `.env.local` locally and
Vercel's environment variable settings in production.

## Decisions

1. **App-wide error capture**, not scoped narrowly to unlock/decrypt —
   `@sentry/nextjs`'s standard instrumentation catches uncaught errors
   everywhere (API routes, every page), and a crash anywhere else (a
   save failing silently, a stray render error) is exactly the same
   blind spot NK-06 exists to close. The privacy safeguards below apply
   everywhere regardless of where an error originates.
2. **No Session Replay.** Confirmed via Sentry's current docs: Replay is
   only active if `replayIntegration()` is explicitly added — it's
   simply never added here. This isn't "mitigated by masking," it's "the
   feature that could show decrypted text on screen doesn't exist in
   this app's Sentry config at all."
3. **No performance tracing/APM.** `tracesSampleRate` omitted entirely.
   NK-06 asks for error visibility specifically; tracing is a separate
   concern with its own quota and its own privacy surface to reason
   about later, if ever wanted — YAGNI for this pass.
4. **Environment-gated to real production only**, matching this repo's
   own established pattern (`web/src/lib/preview.ts`'s `VERCEL_ENV`
   check, not `NODE_ENV` — `next start` sets `NODE_ENV=production` even
   locally, which would defeat this exact gate). Local dev and Vercel
   preview deployments initialize the SDK (so the code path is
   exercised and doesn't silently rot) but never transmit anything.

## Architecture

Standard `@sentry/nextjs` App Router + Turbopack setup (verified current
against Sentry's docs and a live GitHub issue thread, not assumed —
Turbopack support requires SDK ≥9.9.0 and Next.js ≥15.3.0-canary.8; this
app is on Next.js 16.3.2, comfortably past both):

- **`instrumentation.ts`** (project root) — registers the server/edge SDK
  based on `NEXT_RUNTIME`, and exports `onRequestError` so server-side
  errors (API routes, Server Components) reach Sentry.
- **`instrumentation-client.ts`** (project root) — initializes the
  browser SDK. This is where the privacy configuration in the section
  below actually lives for client-side errors.
- **`sentry.server.config.ts`** / **`sentry.edge.config.ts`** — the
  `Sentry.init()` calls for each runtime, dynamically imported by
  `instrumentation.ts`.
- **`next.config.ts`** — wrapped with `withSentryConfig`, composed
  *around* the existing `withSerwist` wrapper (i.e.
  `withSentryConfig(withSerwist(nextConfig))`) so both plugins' build-time
  work happens — Sentry's for source maps, Serwist's for the service
  worker. Only well-supported, non-webpack-specific options used, per
  the Turbopack caveat found during research ("Turbopack doesn't support
  webpack-specific Sentry configuration options").
- **`src/app/global-error.tsx`** — a minimal React error boundary at the
  root of the App Router, the one class of error (React rendering
  errors) `onRequestError`/browser instrumentation doesn't otherwise
  reach. Renders a plain, calm fallback — no stack trace or technical
  detail shown to the user, consistent with the app's existing tone
  (e.g. `UnlockGate`'s own error states).

## Privacy configuration — shared between client and server config

A single scrubbing module (`src/lib/monitoring/sentryScrub.ts`), pure
functions, imported by both `instrumentation-client.ts` and
`sentry.server.config.ts`/`sentry.edge.config.ts` so the policy is
defined once, not duplicated and allowed to drift:

- **`sendDefaultPii: false`** — set explicitly in every config file,
  even though it's already the SDK default. This repo's convention
  (see `content/encryption.md`) is to state a security posture as a
  checkable fact, not lean on an implicit default someone could change
  later without noticing what it was protecting.
- **`beforeBreadcrumb`** — drops any breadcrumb with `category ===
  "console"` outright (can't guarantee no future `console.log` anywhere
  in this codebase, or a dependency's, ever touches something
  sensitive — this is defense against code that doesn't exist yet, not
  just what's here today).
- **`beforeSend`** — strips `request.data`, `request.cookies`,
  `request.headers` from the outgoing event (a second layer beyond
  `sendDefaultPii: false`, not a replacement for it), and recursively
  scrubs any object value under `extra`/`contexts` whose *key* matches a
  known-sensitive pattern (`passphrase`, `secret`, `recovery`, `text`,
  `content`, `plaintext`, case-insensitive) — a blunt but effective net
  against a future mistake, not a claim that today's code needs it.
- **`data-sentry-mask`** attribute added to: the passphrase `<input>`
  and recovery-phrase `<textarea>` in `PassphraseUnlock.tsx`/
  `PassphraseSetup.tsx`, and the composer's title `<input>`/text
  `<textarea>` in `write/page.tsx`. Sentry's DOM-breadcrumb integration
  respects this attribute — click/keypress breadcrumbs on these specific
  elements never include their content, even as a description string.

## Server-side routes — no new risk, but worth stating

`src/app/api/ai/{playback,transcribe,detect-signals}/route.ts` already
carry explicit "must not log or persist" comments for the plaintext they
transiently handle. `sendDefaultPii: false` already prevents Sentry from
capturing request bodies by default; this design doesn't change that
posture, just makes it survive contact with a new dependency — those
three files' existing comments get one added line noting Sentry now
exists too, and the same rule applies to it.

`entries`/`manifestations` routes never see plaintext at all (client-side
encryption model, unchanged) — an error there could at most surface
ciphertext in a request-body capture, which `sendDefaultPii: false`
already prevents regardless.

## Testing

- **Unit tests** for `sentryScrub.ts`'s pure functions: a console
  breadcrumb is dropped, a non-console breadcrumb passes through
  unchanged, an event with `request.cookies` set has it stripped, an
  `extra` field named `passphrase`/`recoveryPhrase` is redacted, an
  unrelated `extra` field (e.g. `route`) survives untouched.
- **Live verification, preview mode:** trigger a deliberate test error,
  confirm zero network requests to any `*.sentry.io` origin (environment
  gate working — nothing transmits outside real production).
  `data-sentry-mask` attributes present in the rendered DOM on the
  passphrase/recovery/composer inputs.
- **Live verification, production-like build:** temporarily allow the
  gate to pass locally, trigger a deliberate test error, confirm the SDK
  attempts the send successfully (network request succeeds, no client
  console errors) — this confirms the wiring is correct without needing
  to log into the Sentry dashboard to visually confirm receipt, which is
  the user's own account to check afterward if they want that final
  confirmation.
