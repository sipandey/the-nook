# The Nook — Product & Architecture Reference

Status: implemented. Every screen in the design canvas is built and wired to real data — see [`web/README.md`](../web/README.md) for the concrete "what's built" list and the honest remaining-gaps list. This document stays the source of truth for product intent, data model, and system architecture; treat it as the base context for implementation — human or AI agent.

## 1. Product summary

The Nook is a mobile-first, AI-assisted journaling app. Users write (or speak) daily entries; the app's distinguishing feature is turning that archive into reflection — surfacing patterns, playing back growth over time, and reinforcing the user's own stated intentions ("manifestations") using their own words, not generic affirmations.

Design direction: light, calm, "sage" palette (soft green hills / forest motif), explicitly not the violet/gradient look common to AI products. Full mobile screen flow and visual reference: see the published [Journal App Mobile Flow](https://claude.ai/code/artifact/36d63c97-7c7c-4fd6-8234-b35ea36ed857) design canvas — this document should be read alongside it, not instead of it.

## 2. Core features

| Feature | Summary |
|---|---|
| Journaling | Text or voice entry, mood scale, freeform tags, AI-suggested daily prompt |
| Tone selection | User picks the AI's voice — Coach, Friend, Mirror, or Minimal — set once, editable anytime |
| Playback | Story-format recap (week / month / year), swipeable cards: mood trend, highlighted quote, then-vs-now comparison, a "letter from past self" |
| Manifestations | User-authored goals/affirmations; AI passively detects signals of progress in new entries and resurfaces the manifestation when relevant |
| Full-entry reading | Long-form reader for any past entry, reachable from the journal list or from inside a playback card |
| Reminders | Opt-in, low-frequency notifications (daily prompt, playback ready, manifestation resurfaced) — explicitly no streak-shaming or "we miss you" messaging |
| Privacy | Entries are unreadable to the operator by design (see §5) |

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Client | Next.js (App Router, TypeScript), mobile-first PWA | One codebase, installable to home screen, no app-store review cycle |
| Styling | Tailwind CSS | Maps directly to the sage design tokens; fast for a solo builder |
| Client state | Zustand (local/session state) + TanStack Query (server state/cache) | Minimal boilerplate at this scale |
| Offline | Serwist (Workbox's App Router-compatible successor) for app-shell caching, IndexedDB for draft entries in progress | Entries in progress shouldn't be lost on a dropped connection |
| Hosting / backend | Vercel — Next.js Route Handlers as the API, Vercel Functions (Node.js runtime) for AI calls, Vercel Cron for scheduled notifications | No servers to operate solo; generous free tier |
| Database | Supabase (managed Postgres) with Row-Level Security | One vendor for DB + storage; RLS keyed off the authenticated user |
| Auth | Clerk — hosted sign-up/sign-in UI, session management, social login | Polished auth with minimal build effort; integrates natively with Supabase RLS via Clerk-as-external-auth-provider support |
| Encryption | Web Crypto API (AES-256-GCM) + Argon2id (via `hash-wasm`), entirely client-side | See §5 — this is the one piece that is not "just a managed service" |
| AI — text | OpenAI (GPT-4o-mini class model) | Prompts, playback narratives, manifestation-signal detection |
| AI — voice | OpenAI Whisper | Voice-entry transcription; same vendor/key as text AI |
| Notifications | Web Push (VAPID), triggered by Vercel Cron | Native-feeling reminders from a PWA |

Explicit non-choice: no separate backend framework/service — Next.js Route Handlers + Vercel Functions are the entire backend at this scale.

## 4. Data model

Two identity systems are intentionally decoupled: **Clerk** owns "who is this user" (account, session, login password). **Supabase** owns "what does this user's journal contain," keyed by the Clerk user ID, and never sees the login password or the journal passphrase.

```mermaid
erDiagram
    USERS ||--o{ ENTRIES : writes
    USERS ||--|| JOURNAL_KEYS : has
    USERS ||--o{ MANIFESTATIONS : sets
    MANIFESTATIONS ||--o{ MANIFESTATION_SIGNALS : accumulates
    ENTRIES ||--o{ MANIFESTATION_SIGNALS : "detected in"
    USERS ||--o{ NOTIFICATION_PREFS : configures
    USERS ||--o{ DEVICE_SYNC_SESSIONS : "pairs via"

    USERS {
        text clerk_user_id PK
        timestamptz created_at
    }
    JOURNAL_KEYS {
        text user_id FK
        text wrapped_dek
        text wrapped_dek_iv
        text wrapped_dek_salt
        text wrapped_dek_recovery
        text wrapped_dek_recovery_iv
        text wrapped_dek_recovery_salt
        jsonb kdf_params
    }
    ENTRIES {
        uuid id PK
        text user_id FK
        timestamptz created_at
        int mood_score
        text[] tags
        text encrypted_content
        text iv
    }
    MANIFESTATIONS {
        uuid id PK
        text user_id FK
        timestamptz created_at
        text category
        text cadence
        boolean auto_detect
        text encrypted_text
        text iv
        text status
    }
    MANIFESTATION_SIGNALS {
        uuid id PK
        uuid manifestation_id FK
        uuid entry_id FK
        timestamptz detected_at
        float confidence
    }
    NOTIFICATION_PREFS {
        text user_id FK
        boolean daily_prompt_enabled
        time daily_prompt_time
        boolean playback_ready_enabled
        boolean manifestation_enabled
    }
    DEVICE_SYNC_SESSIONS {
        text pairing_id PK
        text user_id FK
        text encrypted_dek
        text encrypted_dek_iv
        timestamptz expires_at
    }
```

Design rule: only the metadata a query genuinely needs (mood score, tags, timestamps, cadence/status flags) is stored in the clear. Anything that is the user's actual words — entry content, manifestation text — is stored only as `(encrypted_content, iv)`, encrypted client-side before it ever reaches the network.

Ciphertext/key-material columns are `text` (base64), not `bytea` — see `0002_ciphertext_as_text.sql`. The original `bytea` choice assumed Postgres would hold raw binary, but everything in `src/lib/crypto` produces base64 strings for JSON transport anyway, and PostgREST's `bytea` wire format (hex-encoded) doesn't match that without extra encoding work that buys nothing here.

`device_sync_sessions` (`0003_device_sync.sql`) is deliberately ephemeral — see §5's multi-device note and §6.7.

## 5. Encryption architecture

The threat model: the operator (database, backend code, and anyone who compromises either) should not be able to read journal entries, even under legal compulsion or a data breach.

Two independent secrets, by design:

- **Account password** (Clerk) — proves who you are. A reset here does not touch journal data.
- **Journal passphrase** (app-specific, set in a dedicated onboarding step, distinct from Clerk) — the only thing that unlocks entries. There is no server-side reset path; losing it and the recovery code means permanent loss of the archive. This is a stated tradeoff, not an oversight — see the Recovery Code screen copy in the design canvas.

```mermaid
flowchart TD
    P["Journal passphrase (user-entered, client-only)"] -->|Argon2id + salt| KEK["Key-Encryption Key"]
    DEK["Data-Encryption Key (random AES-256, generated once)"] -->|wrapped by| KEK
    KEK --> WDEK["wrapped_dek → stored in Supabase"]
    R["Recovery code (shown once at signup)"] -->|Argon2id + salt| RKEK["Recovery KEK"]
    DEK -->|wrapped by| RKEK
    RKEK --> WDEKR["wrapped_dek_recovery → stored in Supabase"]
    DEK -->|AES-256-GCM| PLAIN["Entry / manifestation plaintext"]
    PLAIN --> CIPHER["encrypted_content + iv → stored in Supabase"]
```

Consequences that follow from this model, worth stating explicitly for implementation:

1. **The server never persists plaintext.** The one exception is transient, in-memory handling during an AI call (§6.4) — never logged, never written to disk or a database row.
2. **AI-generated output derived from plaintext is itself sensitive.** A playback narrative or a detected manifestation signal is generated from decrypted content. If it's cached server-side for reuse, it must be re-encrypted client-side with the DEK before that round-trip — it does not get a free pass just because the AI produced it rather than the user.
3. **Multi-device sync doesn't touch this model at all — it's a parallel path.** Re-entering the passphrase always works (same `wrapped_dek` row, any device). For a faster handoff, an already-unlocked device can transmit the DEK to a new one via a short-lived, server-relayed exchange encrypted under a one-time "channel key" that's generated on the new device and never sent to the server — see §6.7. The server only ever holds that ciphertext, briefly.

## 6. Sequence diagrams

### 6.1 Account signup + journal passphrase setup

```mermaid
sequenceDiagram
    actor U as User
    participant C as Client (PWA)
    participant Clerk
    participant API as Vercel Route Handler
    participant DB as Supabase

    U->>C: Enter email + account password
    C->>Clerk: Create account
    Clerk-->>C: Session token
    U->>C: Enter journal passphrase (separate secret)
    C->>C: Generate random DEK
    C->>C: Derive KEK = Argon2id(passphrase, salt)
    C->>C: wrapped_dek = encrypt(DEK, KEK)
    C->>U: Show recovery code (once)
    C->>C: Derive recoveryKEK = Argon2id(recoveryCode, salt2)
    C->>C: wrapped_dek_recovery = encrypt(DEK, recoveryKEK)
    C->>API: POST wrapped_dek, salt, wrapped_dek_recovery, salt2
    API->>DB: Insert into journal_keys (keyed by Clerk user id)
    Note over C: Passphrase, recovery code, and raw DEK never leave the client
```

### 6.2 Login + unlock

```mermaid
sequenceDiagram
    actor U as User
    participant C as Client (PWA)
    participant Clerk
    participant API as Vercel Route Handler
    participant DB as Supabase

    U->>C: Sign in
    C->>Clerk: Authenticate
    Clerk-->>C: Session token
    C->>API: GET journal_keys
    API->>DB: Fetch wrapped_dek + salt
    DB-->>C: wrapped_dek, salt
    U->>C: Enter journal passphrase
    C->>C: KEK = Argon2id(passphrase, salt)
    C->>C: DEK = decrypt(wrapped_dek, KEK)
    Note over C: DEK held in memory only for the session
```

### 6.3 Create a journal entry

```mermaid
sequenceDiagram
    actor U as User
    participant C as Client (PWA)
    participant API as Vercel Route Handler
    participant DB as Supabase

    U->>C: Write or dictate entry, set mood + tags
    C->>C: encrypted_content, iv = AES-256-GCM(entry text, DEK)
    C->>API: POST encrypted_content, iv, mood, tags, created_at
    API->>DB: Insert row (RLS scoped to user)
    DB-->>API: OK
    API-->>C: Saved confirmation
    C->>U: Show saved state (mood/tags recap, streak)
```

### 6.4 AI prompt / playback generation

```mermaid
sequenceDiagram
    actor U as User
    participant C as Client (PWA)
    participant EF as Vercel Function (AI calls)
    participant AI as OpenAI API
    participant DB as Supabase

    C->>DB: Fetch encrypted entries for the period
    DB-->>C: encrypted_content rows
    C->>C: Decrypt entries locally with DEK
    C->>EF: POST plaintext (TLS, transient)
    EF->>AI: Generate playback narrative / detect signals
    AI-->>EF: Result
    EF-->>C: Result
    Note over EF: Plaintext never logged or persisted by EF
    opt User wants the narrative cached
        C->>C: Re-encrypt narrative with DEK
        C->>DB: Store encrypted narrative
    end
```

### 6.5 Voice entry

```mermaid
sequenceDiagram
    actor U as User
    participant C as Client (PWA)
    participant EF as Vercel Function (AI calls)
    participant AI as OpenAI Whisper

    U->>C: Record voice entry (MediaRecorder + AnalyserNode waveform)
    U->>C: Tap "Done"
    C->>EF: POST the full recorded clip
    EF->>AI: Transcribe
    AI-->>EF: Transcript
    EF-->>C: Transcript, dropped into the text editor for review
    C->>C: Encrypt on save, same path as §6.3
    Note over EF: Raw audio is not persisted server-side
```

Deliberately **batch, not live-streaming**: the waveform shown while recording is real (genuine audio levels via `AnalyserNode`), but the transcript only appears after "Done" — Whisper's REST API has no incremental-result mode. True live, word-by-word transcription would need OpenAI's Realtime (WebSocket) API, evaluated and explicitly deferred as a materially bigger swap than this covers.

### 6.6 Daily reminder notification

```mermaid
sequenceDiagram
    participant Cron as Vercel Cron
    participant API as Vercel Route Handler
    participant DB as Supabase
    participant SW as Service Worker (client)

    Cron->>API: Trigger at each user's scheduled time
    API->>DB: Read notification_prefs (unencrypted metadata only)
    API->>SW: Web Push (VAPID) — generic body, no entry content
    SW-->>U: Lock-screen notification
```

Note: the lock-screen mockup in the design canvas shows descriptively rich preview text (e.g. quoting the day's prompt, or the subject of a resurfaced manifestation's entry). That's illustrative of the *feature*, not the shipped copy — see §8's resolved notification-content-richness item: bodies are generic for all three types ("Time to reflect" / "Your weekly playback is ready" / "A manifestation resurfaced"), no exceptions.

### 6.7 Multi-device key sync

```mermaid
sequenceDiagram
    actor New as New device (locked)
    actor Old as Already-unlocked device
    participant API as Vercel Route Handler
    participant DB as Supabase

    New->>New: Generate pairingId + random channel key (AES-256, client-only)
    New->>API: POST pairingId
    API->>DB: Insert device_sync_sessions row (5 min expiry)
    New->>New: Show QR encoding a URL with #key=channelKey (fragment, never sent to any server)

    Old->>Old: Scan QR / open link — lands on /settings/device-sync/confirm
    Note over Old: Getting here already required this device to be signed in AND unlocked (UnlockGate) — that IS "already-unlocked device"
    Old->>Old: encryptedDek = AES-GCM(DEK, channelKey)
    Old->>API: PATCH pairingId {encryptedDek, iv}
    API->>API: Verify caller's Clerk userId matches the session's owner
    API->>DB: Store encrypted_dek, encrypted_dek_iv

    loop Poll every ~2.5s
        New->>API: GET pairingId
        API->>DB: Fetch row
    end
    API-->>New: encryptedDek, iv
    API->>DB: Delete row (single-use)
    New->>New: DEK = decrypt(encryptedDek, channelKey) — unlocked
```

The server only ever holds `encrypted_dek` — ciphertext under a key it never sees, for at most 5 minutes, deleted on pickup. This runs alongside passphrase/recovery-code unlock as a third option, not a replacement for either.

## 7. System architecture

```mermaid
graph TD
    subgraph Client["Client — Next.js PWA"]
        UI[React UI]
        SW[Service Worker]
        Crypto[Web Crypto + Argon2id]
        IDB[(IndexedDB — draft cache)]
    end

    subgraph Vercel
        RH[Route Handlers]
        EF["Vercel Functions (AI calls)"]
        Cron[Vercel Cron]
    end

    Clerk[Clerk — Auth]
    Supabase[(Supabase — Postgres + RLS)]
    OpenAI[OpenAI — GPT + Whisper]

    UI <--> Crypto
    UI <--> IDB
    UI <--> SW
    UI -->|session| Clerk
    UI -->|encrypted data| RH
    UI -->|plaintext, transient| EF
    RH --> Supabase
    EF --> OpenAI
    EF -.->|never persists plaintext| Supabase
    Cron --> RH
    SW -->|push| UI
```

This diagram shows the intended shape, not a claim that every box is live: `SW` (service worker) and `IDB` (IndexedDB draft cache) are designed but not yet wired, and `Cron` isn't configured — see §8 for the concrete gap list.

## 8. Security boundaries & explicit non-goals

- The database and backend code never store readable entry content. The only place plaintext exists outside the client is transiently inside a Vercel Function during an AI call.
- Account password (Clerk) and journal passphrase are independent. Compromising or resetting one does not expose data protected by the other.
- There is no "forgot journal passphrase" server-side reset. The recovery code is the only backup path, by design — this is a stated cost of the privacy model, not a gap to close.
- Resolved since the last pass:
  - **Multi-device key handling.** Built — see §6.7. QR-code handoff between an already-unlocked device and a new one, server-relayed but never server-readable.
  - **Data export / account deletion.** Built, in Settings. Export decrypts everything client-side and downloads JSON — no server route needed, since the server never had anything but ciphertext. Deletion is type-to-confirm, wipes every Supabase table for the user, then deletes the Clerk account itself (data first, while the session's still valid; Clerk account last, since that's irreversible).
  - **Whisper audio retention.** Confirmed as implemented: `VoiceRecorder` sends the recorded blob directly to `/api/ai/transcribe` and neither side writes it anywhere. Also now explicitly *not* live-streaming — see §6.5.
  - **Notification content richness vs. lock-screen privacy.** Decided: generic body text for all three notification types, no exceptions, no per-type richness, no Settings toggle to opt into more — the lock-screen mockup's descriptive previews (particularly the manifestation type, which quoted a real entry's subject directly — see `design/mobile-flow/LockScreenNotifications.dc.html`) were illustrative of the feature, not the shipped copy. Exact bodies: daily prompt → "Time to reflect"; playback ready → "Your weekly playback is ready" (the mockup's version was already generic, unchanged); manifestation resurfaced → "A manifestation resurfaced" (the mockup's version quoted the entry's subject — that's what this decision removes). An opt-in toggle for richer previews was considered and deliberately deferred, not rejected — build it only if real usage shows people actually want it, not speculatively. This unblocks NK-09 (Web Push subscription flow) and NK-10 (Vercel Cron) — both were blocked on this decision, not on anything technical.
  - **Offline write conflict handling.** Built — see `src/lib/hooks/useComposerDraft.ts` and `src/lib/composer/draftStore.ts`. The composer's draft autosaves to IndexedDB (debounced, plus an immediate flush on `visibilitychange`) encrypted with the DEK, and restores on reopen with a dismissible banner. No sync-back/conflict resolution needed beyond that: entries only gained an update path for today-only, single-writer appends (§10.6.2, NK-16) — no cross-device or concurrent-edit case exists to resolve.
  - **PWA installability.** Service worker registered — see `src/app/sw.ts`, `src/app/serwist/[path]/route.ts`, `SerwistProvider` in `src/app/providers.tsx`. Offline app-shell caching confirmed working (verified live: killed the local server process entirely, a previously-visited page stayed fully available, a never-visited one fell back to the on-brand `/~offline` page). `manifest.json` and icon sizes already existed; actual Add to Home Screen on a real device is still untested.
- Still open (flag before building the relevant piece):
  - Nothing currently — see `docs/ROADMAP.md` for what's next.

## 9. Screen inventory

Full visual reference: [Journal App Mobile Flow](https://claude.ai/code/artifact/36d63c97-7c7c-4fd6-8234-b35ea36ed857). This table describes the design canvas as designed — where implementation deliberately diverged (voice transcription is batch, not the live streaming shown in the mockup; see §6.5), the mockup description stays as the original intent and the actual behavior is documented where it's implemented. For current build status per area, see [`web/README.md`](../web/README.md)'s "What's built" / "Known gaps" lists.

| Screen | Purpose |
|---|---|
| Account signup (Clerk-style) | Email/password or social login, creates the Clerk account |
| Journal passphrase setup | Sets the separate encryption secret |
| Recovery code | One-time display of the account's only backup path |
| Tone selection | Coach / Friend / Mirror / Minimal |
| Notification permission | Soft pre-permission ask, per-notification-type toggles |
| Lock screen notification (mockup) | Illustrates push notification appearance |
| Home | Daily prompt, mood check-in, streak, recent entries |
| Journal list | Dated list of past entries, grouped by month |
| Entry detail | Long-form reader for a full past entry |
| Entry composer | Text entry with mood + tags |
| Entry composer — voice | Live waveform, timer, streaming transcript |
| Entry composer — saved | Confirmation state, privacy reassurance, streak update |
| Playback hub | Week/month/year recap selector |
| Playback story cards (×4) | Mood trend, highlighted quote, then-vs-now, letter from past self |
| Manifestations list | Goals with AI-detected progress signals |
| Manifestation add/edit | Goal text, category, resurfacing cadence, auto-detect toggle |
| Settings | Tone, encryption/privacy, notifications, account |

## 10. AI cost optimization & semantic search

Status: **implemented in full.** Every item in §10.5's sequencing is built: daily-prompt cache (§10.2), AI rate limiting/usage logging (§10.6.3), the embedding-quality spike (§10.5 step 3), semantic search (§10.3–§10.4, `/search`), and the playback narrative client-side cache (§10.2). This section is written to the same standard as the rest of this document — it should be treated as the source of truth for intent once any part of it starts landing, and updated (not left to drift) as pieces ship.

### 10.1 Current AI call inventory

All calls go through `src/lib/ai/openai.ts` (`gpt-4o-mini` for text, `whisper-1` for audio). Only the prompt route is cached; the other three have no caching. All four now have rate limiting and usage logging (§10.6.3).

| Route | Trigger | Input sensitivity | Cacheable? |
|---|---|---|---|
| `GET /api/ai/prompt` | Home screen load (`useDailyPrompt`, `staleTime: Infinity` client-side only) | None — `generateDailyPrompt(tone, [])` is called with an always-empty entries arg | **Implemented** — see §10.2 |
| `POST /api/ai/playback` | "Play Your Week/Month/Year" tap | High — decrypted entry text, transient | Yes, per `(user, period, entry set)` |
| `POST /api/ai/detect-signals` | Every entry save (fire-and-forget) | High — decrypted entry + manifestation text, transient | No — must run per entry to do its job |
| `POST /api/ai/transcribe` | Voice entry "Done" | High — raw audio, transient | No — unique audio each time |

### 10.2 Caching strategy per call site

**Daily prompt — implemented.** Because `recentEntrySummaries` is hardcoded to `[]` (`src/app/api/ai/prompt/route.ts`'s own comment marks personalization as unbuilt), the output is identical for every user sharing a `(tone, date)` pair — i.e., at most 4 distinct outputs exist on any given day, but every user independently paid for their own generation of one of those 4. Cached by `(tone, cache_date, template_version)` in a new `prompt_cache` Supabase table (`supabase/migrations/0004_prompt_cache.sql`), a plain table rather than a new KV/Redis vendor, per §10.6.5's recommendation:

```mermaid
sequenceDiagram
    actor U as User
    participant C as Client
    participant API as /api/ai/prompt
    participant DB as Supabase (prompt_cache)
    participant AI as OpenAI

    C->>API: GET ?tone=friend
    API->>DB: select where (friend, 2026-08-24, v1)
    alt cache hit
        DB-->>API: cached prompt
    else cache miss
        API->>AI: generateDailyPrompt(friend, [])
        AI-->>API: prompt
        API->>DB: insert (friend, 2026-08-24, v1, prompt)
        Note over API,DB: unique constraint on (tone, cache_date,<br/>template_version) makes concurrent misses<br/>single-flight — a losing insert (23505) re-selects<br/>and serves the winning row instead of its own
    end
    API-->>C: prompt
```

Collapses N users/day to ≤4 OpenAI calls/day. `cache_date` is the UTC calendar date — an explicit, simple day boundary (§10.6.1 flagged this as ambiguous if left implicit); a user near UTC midnight may see the prompt change at a time that doesn't match their local midnight, accepted for now. `template_version` (`DAILY_PROMPT_TEMPLATE_VERSION` in `src/lib/ai/openai.ts`) lets a future prompt-engineering change invalidate old cache rows immediately instead of waiting out up to 24h of staleness.

**Deliberately not CDN/edge-cached.** The original proposal suggested `Cache-Control: public, s-maxage=86400` so Vercel's edge could serve repeat requests without invoking the function at all. Dropped during implementation: this route is gated by an `auth()` check, and a CDN-level cache hit never re-executes the origin function — so a publicly cacheable response on an authenticated route would let a cached hit bypass the auth check entirely for any caller, not just authenticated ones. The Supabase-backed cache still gets the real win (≤4 OpenAI calls/day); it costs one DB round trip per request instead of a free CDN hit, which is the right trade for keeping the auth check load-bearing.

**This caching is only valid because the prompt is unpersonalized** — the moment `recentEntrySummaries` is wired up, output becomes per-user and falls under the re-encrypt-before-persisting rule in §5, point 2, and this whole cache design must be revisited.

**Playback narrative — implemented.** Previously every "Play Your Week" tap re-generated the narrative, even for an unchanged period. `src/lib/playback/narrativeCache.ts` fixes this with a cache key hashed from `(period, tone, sorted entry (id, updated_at) pairs)` — the `updated_at` component matters because entries gained an append-only update path (§10.6.2, NK-16), so a bare entry-ID key would serve a stale narrative after an append. Implemented as a client-side IndexedDB cache (one database per user), the low-risk version called for here: zero new infrastructure, operating on the client's own already-decrypted data. Vectors — in this case the narrative JSON — are AES-GCM-encrypted with the DEK before ever touching IndexedDB, same posture and same reasoning as the search vector cache (§10.6.6): a verbatim quote lifted from an entry (`PlaybackNarrative.highlightQuote`) is exactly the kind of AI-output-derived-from-plaintext §5 point 2 already flags as sensitive. A cross-device version (a small `playback_cache` Supabase table storing `(encrypted_narrative, iv)` per §6.4's existing "opt" note) remains a real, un-built follow-up — each device currently builds its own cache independently, same accepted-gap shape as §10.6.8's multi-device search limitation.

**Signal detection.** Already skips the call entirely with zero active manifestations. The remaining lever isn't caching — see §10.6.4 (uncapped entry length).

**Transcription.** No caching axis; each recording is unique.

### 10.3 Semantic search — design options

Computing an embedding requires plaintext, and a queryable similarity index requires the vectors to sit somewhere a similarity function can reach them. Both are in tension with §5's threat model ("the operator... should not be able to read journal entries... even under legal compulsion"). Embeddings are not plaintext, but they are known to be partially invertible — recent research recovers meaningful content from embedding vectors — so this document treats them as sensitive as the entries themselves, not as harmless derived data.

| Option | Where embeddings are computed | Where search runs | OpenAI cost/entry | Compatible with §5's threat model |
|---|---|---|---|---|
| **A — Client-side model** | In-browser (transformers.js, quantized MiniLM-class model) | In-browser, cosine similarity over cached vectors | None | Yes |
| **B — Server-assisted, client search** | Vercel Function via OpenAI embeddings API, transient plaintext (mirrors §6.4) | In-browser — vectors are pulled down and decrypted, same as A | Yes, per entry | Yes, but only if search itself stays client-side (see §10.6.6) |
| **C — Server-side plaintext/vector index** (pgvector, Pinecone, etc.) | Server | Server | Yes | **No — rejected.** An unencrypted, queryable semantic index of the journal is the exact thing §5 promises won't exist. |

```mermaid
sequenceDiagram
    actor U as User
    participant C as Client (PWA)
    participant W as Web Worker
    participant IDB as IndexedDB (encrypted vectors)

    Note over C: One-time or incremental, per entry
    C->>C: Decrypt entry with DEK (already done for Journal list)
    C->>W: plaintext + entry id
    W->>W: Embed locally (in-browser model)
    W-->>C: vector
    C->>C: Encrypt vector with DEK
    C->>IDB: store (entry id → encrypted vector)

    Note over U,IDB: At search time
    U->>C: Search query
    C->>W: embed(query)
    W-->>C: query vector
    C->>IDB: read + decrypt all cached vectors
    C->>C: cosine similarity, rank, return entry ids
```

### 10.4 Recommendation

Option A. It is the only option with zero incremental OpenAI cost, the only one that doesn't touch the zero-knowledge promise at all (server never sees plaintext or vectors, full stop — no "transient" caveat needed), and journal search doesn't need enterprise-RAG-grade relevance to be useful. Build scope is a client-side lib, an encrypted IndexedDB store, and a search UI — no new backend surface. The quality spike (§10.5 step 3) validated this: use `Xenova/all-MiniLM-L12-v2`, not the smaller/more commonly-defaulted-to L6 variant — see `docs/spikes/embedding-quality/RESULTS.md`.

### 10.5 Recommended sequencing

1. **Daily prompt cache** — done (§10.2). Smallest change, real savings starting day one, no encryption questions.
2. **Rate limiting + usage logging on all four `/api/ai/*` routes** (§10.6.3) — done.
3. **Spike: in-browser embedding quality** — done, result is **go**. `docs/spikes/embedding-quality/RESULTS.md`: `Xenova/all-MiniLM-L12-v2` hit 100% top-3 retrieval on 12 deliberately vocabulary-disjoint test queries against 20 realistic journal entries. Validates option A (§10.3/§10.4) over falling back to OpenAI embeddings.
4. **Playback narrative client-side cache** — done. `src/lib/playback/narrativeCache.ts`, wired into `usePlaybackNarrative`.
5. **Semantic search UI** — done. `/search`, entry point from the Journal list. Built against `all-MiniLM-L12-v2` in a Web Worker (`src/lib/search/embed.worker.ts`), lazy-loaded only on explicit opt-in (§10.6.7), encrypted vector cache in IndexedDB via the DEK (§10.6.6, `src/lib/search/vectorStore.ts`).

### 10.6 Critical review & open risks

This section exists to stress-test §10.1–10.5 rather than let the proposal stand unchallenged — in the same spirit as §8's "still open" list.

**10.6.1 — Daily prompt cache: day-boundary and stampede issues — addressed in the implementation, one tradeoff accepted deliberately.** "Date" is ambiguous across timezones; the implementation picks UTC midnight as an explicit, simple cutover rather than leaving it implicit. A user near that boundary sees the prompt "change" at a time that doesn't match their local midnight — accepted, not fixed, since a per-user local-date key would give up most of the 4-per-day collapse (approaching one cache entry per timezone-offset × tone instead of 4 total). Concurrent cache-miss requests at day rollover are handled by the database's own unique constraint on `(tone, cache_date, template_version)`, not application-level locking: a losing concurrent insert fails with a unique-violation error, and that caller re-selects and serves the winning row instead of generating a second time — genuinely single-flight, not just check-then-write. `template_version` is in place so a future prompt-engineering change can invalidate stale rows immediately rather than waiting out up to 24h.

**10.6.2 — Playback cache: RESOLVED.** This section originally warned that the cache key (entry ID set alone, no timestamp) was only valid while entries stayed immutable, and would silently go stale if entry editing ever shipped. It did: NK-16 (`docs/plans/2026-08-24-append-to-todays-entry-design.md`) added `entries.updated_at` and a `PATCH /api/entries/[id]` path (today-only, append-only — see below). `buildNarrativeCacheKey` (`src/lib/playback/narrativeCache.ts`) now hashes `(id, updated_at)` pairs instead of bare entry IDs, so an appended-to entry gets a fresh cache key instead of serving a stale cached narrative. Covered by `src/lib/playback/narrativeCache.test.ts`.

**10.6.3 — No cost circuit breaker existed anywhere in the original proposal — addressed for (a) and (b), (c) still open.** All four routes had no rate limiting, no per-user or global spend cap, and no usage logging (verified: no rate-limit or KV/Redis dependency in `package.json`). Caching reduces average cost but does nothing to bound worst case — a bug in a client retry loop, or a user with a scripted client, could still call any of these routes without limit.

Implemented: `ai_usage_log` (`supabase/migrations/0005_ai_usage_log.sql`) — one row per completed call, metadata only (route, model, token counts, timestamp; never content). `src/lib/ai/usage.ts` provides `checkAiRateLimit` (counts this user's rows for a route in a trailing window, generous per-route ceilings — e.g. 20/hour for playback — meant to bound worst case, not constrain normal use) and `recordAiUsage`, wired into all four routes. The rate-limit check runs immediately before the OpenAI call in each route (after cache lookups, where applicable, so a free cache hit doesn't count against a limit meant to bound spend), returns `429 {error: "rate_limited"}` on a hit, and both functions fail open — a DB hiccup degrades to "allow the call" / "skip the log entry," never to blocking or breaking a legitimate request.

Still open: (c), a soft daily *spend* ceiling. What's built bounds call *count* per user per hour, not aggregate dollar cost across all users, and doesn't degrade the whole app to "AI briefly unavailable" the way a global circuit breaker would. `ai_usage_log`'s token counts are enough to build that on top (sum `total_tokens` over a trailing window, multiply by a per-model rate, compare to a ceiling) — not built yet, worth doing once real usage data exists to size the ceiling against, rather than guessing a number now.

**10.6.4 — Entry length is uncapped, unlike manifestation text.** `ManifestationForm.tsx` caps input at 200 characters; the journal entry composer (`write/page.tsx`) has no `maxLength` at all. Both `/api/ai/playback` and `/api/ai/detect-signals` send full entry text to OpenAI, so token cost per call scales unboundedly with what a user chooses to write. A sane cap (a few thousand characters) bounds worst-case cost per call and is cheap insurance against both accidental and deliberate abuse — but it's a product decision, not just an engineering one (a journal app capping entry length is a real UX constraint), so it needs sign-off, not just implementation.

**10.6.5 — The caching proposal quietly introduces a new infrastructure dependency the stack table (§3) doesn't have today.** §3 states the explicit non-choice "no separate backend framework/service." A KV/Redis-backed cache (Vercel KV, Upstash) is a new vendor. A Postgres-table-backed cache (a `prompt_cache` table in the existing Supabase instance) is zero new vendors and fits the stack's stated philosophy better, at the cost of slightly higher read latency than a dedicated KV store. Recommend starting with the Supabase-table version and only reaching for KV if read latency is measured to actually matter — not assumed upfront.

**10.6.6 — The client-side embedding store as described would break an invariant the rest of the app holds carefully — treated as non-negotiable in the implementation.** Everywhere else, nothing derived from plaintext survives a reload without the passphrase — the DEK is memory-only by design (§6.2: "DEK held in memory only for the session"). `src/lib/search/vectorStore.ts` stores every vector AES-GCM-encrypted under the DEK before it ever reaches IndexedDB (same `encryptText`/`decryptText` primitives as entry content); there is no code path that writes a raw vector to disk.

**10.6.7 — Performance and footprint risks for a "mobile-first PWA" — addressed for what's within the feature's own control; one broader gap deliberately left standing.** The model (~34MB) is never fetched on app load or even on visiting `/search` — `useEmbeddingWorker`'s worker is only constructed on the first `embed()` call, which only happens after the user taps "Enable Smart Search" on an explicit intro screen that states the download size up front. Embedding runs inside a dedicated Web Worker (`embed.worker.ts`), never the main thread. `@huggingface/transformers` caches the downloaded model in the browser's Cache API on its own, independent of a service worker, so repeat visits don't re-download it even though: §8's "no service worker registered" gap is still real and still not this feature's to close — search benefits from a service worker existing (offline app-shell, more predictable caching behavior) but doesn't depend on one for its core function to work.

**10.6.8 — Multi-device search remains an accepted gap, unchanged by the implementation.** §6.7 (multi-device key sync) has no awareness of `vectorStore.ts`'s per-user IndexedDB store — a newly-synced device starts search from zero and re-embeds the entire archive on first opt-in there, same as a brand-new browser profile would. Not solved, not attempted; stated here so it's an explicit, accepted limitation rather than a future bug report.

**10.6.9 — Model hosting is still an undecided operational detail, deliberately deferred.** `embed.worker.ts` uses `@huggingface/transformers`'s default behavior — fetching the model from a HuggingFace CDN at runtime, not a vendored/self-hosted copy. This is a real third-party runtime dependency for a core feature, and worth revisiting once the app has any offline story at all (which it doesn't yet — §8, no service worker registered); building offline support and self-hosting the model at the same time would have been solving a problem (offline availability) the rest of the app doesn't support yet either. Deferred deliberately, not overlooked.

**10.6.10 — In-browser embedding quality — validated for the case tested, with real caveats left standing.** `docs/spikes/embedding-quality/RESULTS.md`: `Xenova/all-MiniLM-L12-v2` (34MB quantized) hit 100% top-3 / 75% top-1 retrieval across 12 queries written to share no vocabulary with their target entry, against 20 realistic journal entries — a genuine test of semantic rather than keyword matching. `all-MiniLM-L6-v2` (23MB) was noticeably worse (83% top-3), including one near-total miss, so **L12 is the model to build against, not L6**, despite L6 being the more commonly reached-for default in transformers.js examples.

What the spike does not cover, and still needs validating before shipping (not before building — these are the kind of thing you learn by building the real thing on a real device, not by writing more spike code): real-browser inference speed on a lower-end phone (Node's ONNX backend isn't the browser's WASM/WebGL one — quality transfers since it's the same weights, speed doesn't), retrieval behavior at hundreds–thousands of entries rather than 20, and non-English or heavily colloquial text, which 20 standard-English entries can't speak to.
