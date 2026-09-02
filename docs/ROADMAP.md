# The Nook — Product Backlog & Roadmap

Status: assessed 2026-08-24 against `main` @ `fe19e8a`.

**Since assessed:** NK-01 through NK-05 shipped — **Phase 0 (Integrity) is closed.**
NK-07, NK-08, NK-10, and NK-11 shipped — **Phase 1 (deliver the advertised
product) is now built end to end.** NK-09 is built and mostly verified — one
piece (the live subscribe-and-receive round trip) needs a human, since browser
automation can't satisfy the permission prompt's trusted-gesture requirement, by
design. §1's table below is left as-is rather than rewritten, since it's an
honest record of state at assessment time; §3's backlog rows and §6's checklist
are the current-status source of truth. Next up: close out NK-09 with one real
click, or start Phase 2 (economics & real-device truth — NK-12/NK-13/NK-14).

This document is a reading of **state** — what is actually true of the build right
now, and what to do about it in what order. [`ARCHITECTURE.md`](ARCHITECTURE.md)
remains the source of truth for **intent**; where the two disagree, that one wins on
what the product is *meant* to be and this one wins on what it currently *is*.

Gap analysis drawn from `ARCHITECTURE.md` §8 and §10.6, [`web/README.md`](../web/README.md)'s
known-gaps list, and a direct survey of routes, dependencies, and CI configuration.

Published visual version: [The Nook Roadmap](https://claude.ai/code/artifact/efcb405e-b439-4efb-9b6b-345501fe41f2).

## 1. The strategic read

Every screen in the design canvas is implemented and wired to real data — auth,
encryption, AI, semantic search, device sync. That is precisely what makes the
remaining work dangerous: **the gaps are invisible from the UI.** None of them look
like missing features. All of them look like a working app that quietly breaks its
own promise.

The backlog below is therefore not a feature list. It is a list of places where the
shipped product contradicts the thing it tells users about itself.

**Three shipped contradictions:**

| The claim | The reality |
|---|---|
| "A quiet place to write" | The composer holds entry text in plain React state. A refresh, dropped connection, or backgrounded mobile tab loses the entry outright — the worst failure mode a journaling app has. |
| "Technically unreadable to us" (About, Encryption, Privacy pages) | `src/lib/crypto/` carries the entire product claim and has zero test coverage. There is no test suite in the repo at all. A regression in DEK wrapping would be undetectable until someone's archive is unrecoverable. |
| Reminders, listed as a core feature in `ARCHITECTURE.md` §2 | `notification_prefs` is wired to the schema and surfaced in Settings, so users can configure reminders in detail. Nothing sends them — no service worker, no push subscription, no cron. |

**Two gaps not previously tracked in `web/README.md`:**

- **CI never builds the app.** `.github/workflows/agent-room-validate.yml` validates
  the agent-room scaffold only. Nothing runs `tsc`, `eslint`, or `next build` — which
  is exactly why NK-05's lint errors have gone unnoticed.
- **The data layer is untyped.** `src/lib/supabase/types.ts` is still the loose
  placeholder, so every query builder call app-wide has no compile-time column
  checking. A renamed column fails silently at runtime.

## 2. Roadmap

Four gated phases. The gates are real: each phase's exit criteria are preconditions
for the next being worth starting, not milestone decoration.

### Phase 0 — Integrity

Goal: stop the product from betraying its own promise. Nothing here is a feature.

Draft loss, unverified encryption, an untyped data layer, and CI that never builds
the app. These are the four ways the current build can hurt a real user or hide a
real regression. Everything else waits.

**Exit criteria:** no known data-loss path in the composer · crypto round-trip and
tamper-detection tests green in CI · generated Supabase types replacing the
placeholder · CI runs `tsc`, `eslint`, and `next build` on every PR.

### Phase 1 — Deliver the advertised product

Goal: make the PWA a PWA and the reminders actually remind.

Positioning claims an installable, offline-capable, mobile-first PWA with opt-in
reminders (`ARCHITECTURE.md` §2, §3). Today it is a normal web app with a manifest
and no service worker, and two of the seven core features in §2 are non-functional.
This phase closes the gap between the pitch and the artifact.

**Exit criteria:** installable to home screen on iOS and Android · app shell loads
offline · a scheduled reminder actually arrives on a real device · notification
content policy decided and implemented.

### Phase 2 — Economics & real-device truth

Goal: bound worst-case cost; verify Smart Search survives contact with a cheap phone.

Per-user hourly rate limits exist (§10.6.3); an aggregate spend ceiling does not.
Entry length is uncapped (§10.6.4), so token cost per AI call scales with whatever a
user writes. Separately, the embedding spike validated *quality* in Node against 20
entries — not browser WASM *speed* on a low-end phone against a thousand (§10.6.10).

**Exit criteria:** a daily spend ceiling that degrades AI gracefully rather than
failing hard · entry length capped with a decided UX · measured embed and query
latency on a mid-tier Android at 1,000+ entries.

### Phase 3 — Depth

Goal: the things worth building only once people are actually using it.

Entry editing, multi-device search continuity, self-hosted models, non-English
retrieval. Each is real work with a real payoff, and each is speculative until
Phases 0–2 have produced a product people trust enough to accumulate an archive in.

**Exit criteria:** deliberately undefined — sequence this phase from usage, not from
this document.

## 3. Backlog

Sizes are rough and relative: **XS** under an hour · **S** a sitting · **M** a day or
two · **L** multi-day with design thinking attached.

| ID | Priority | Item | Why it matters | Size |
|---|---|---|---|---|
| NK-01 | ~~Blocker~~ Done | Composer draft persistence | Shipped: `src/lib/composer/draftStore.ts` + `src/lib/hooks/useComposerDraft.ts`. Debounced autosave (800ms) plus an immediate flush on `visibilitychange`, encrypted with the DEK before it touches IndexedDB, restored on mount with a dismissible banner. | M |
| NK-02 | Done | Test suite for `lib/crypto/` | `src/lib/crypto/index.test.ts` (Vitest, 14 tests): encrypt/decrypt round-trip, DEK wrap/unwrap under both passphrase and recovery code, tamper/wrong-key/wrong-passphrase/wrong-salt rejection, export/import round-trip — each failure-mode assertion verified to actually fail red against a deliberately broken source before being trusted. Now enforced in CI by NK-04. | M |
| NK-03 | Done | Generate real Supabase types | `src/lib/supabase/types.ts` replaced. Didn't need a linked project or login token after all — `supabase init && supabase start` (Docker, confirmed available) spins up a local Postgres built purely from replaying `supabase/migrations/*.sql`, and `supabase gen types typescript --local` generates against that. Full CI sequence (typecheck/lint/test/build) re-verified clean against the real, strict types — no hidden mismatches the loose placeholder had been masking. Regenerating against the real hosted project once linked would still close a theoretical drift gap (a manual dashboard schema change the migrations don't know about); see the file's own header comment. | S |
| NK-04 | Done | CI that builds the app | `.github/workflows/app-ci.yml`: typecheck (`next typegen && tsc --noEmit` — the bare `tsc` needs `.next/types`, which only a build or `next typegen` produces), lint, `npm test`, then `next build`, on every push/PR to `main`. Node version pinned via `web/.nvmrc` (22.20.0), read by `setup-node` — this repo had no pinned version anywhere before. `next build` needs a dummy `OPENAI_API_KEY` to get past module-scope `new OpenAI(...)` in the three `/api/ai/*` routes; verified Clerk/Supabase keys are NOT required at build time by building with a fully empty environment first. | S |
| NK-05 | Done | Fix standing lint errors | Both `<a>`-instead-of-`<Link>` errors (sign-in/sign-up) fixed — turned out to be a hard prerequisite for NK-04, not a separate follow-up: `npm run lint` genuinely exits 1 on these, so wiring lint into CI without fixing them first would have shipped CI red from the first run. | XS |
| NK-06 | Done | Production error monitoring | Built via `@sentry/nextjs`, active only in real production (`VERCEL_ENV`-gated, matching `preview.ts`'s existing pattern). The roadmap's own stated constraint — "must exclude entry content from payloads" — turned out to need more than the obvious safeguard: `sendDefaultPii: false` alone does *not* prevent Sentry from sending local variable *values* from a crashing function's stack frame by default in the installed SDK version (`dataCollection.stackFrameVariables` defaults to `true`, independent of `sendDefaultPii`) — found by checking the installed package's real type definitions directly, after doc summaries missed it, and would have leaked actual journal plaintext (e.g. `write/page.tsx`'s `handleSave()` local variable holding the combined entry text) on the wrong kind of crash. Every data-collection category is now set explicitly in `src/lib/monitoring/sentryOptions.ts` (TDD'd), console breadcrumbs are dropped outright, and Session Replay is never installed at all. Design: `docs/plans/2026-08-25-sentry-error-monitoring-design.md` (includes a second corrected assumption, about `data-sentry-mask`, found the same way). Deliberately deferred: source-map upload (no Sentry `authToken` configured yet). Honestly unresolved: the SDK's own transport request wasn't directly observed leaving the browser during verification, despite the capture mechanism, config, and real network connectivity to Sentry's ingest endpoint each being independently confirmed — see `.agent-room/decisions.md` for exactly what was and wasn't checked. | S |
| NK-07 | Done | Register the service worker | Wired via `@serwist/turbopack` (not `@serwist/next`, which silently no-ops under Turbopack — see `.agent-room/decisions.md`). Confirmed live in real Chrome, server killed mid-test: registration reaches `activated`, a previously-visited page stays fully available with zero network, and a never-visited page correctly falls back to `/~offline`. (An initial automated-browser test session reported a false failure here — a CDP-automation artifact, not a real bug; see decisions.md for how that was isolated before trusting the real-browser result.) | M |
| NK-08 | Done | Notification content policy | Decided: generic body text for all three notification types, no exceptions, no opt-in-to-richer toggle for now (deferred until real usage asks for it, not built speculatively). Exact copy and rationale in `docs/ARCHITECTURE.md` §8. Unblocks NK-09/NK-10. | — |
| NK-09 | High — mostly verified | Web Push subscription flow | Built: `0006_push_subscriptions.sql` (a subscription per device, RLS-scoped), `/api/push-subscriptions` (POST/DELETE), `usePushSubscription.ts` (subscribe/unsubscribe/status), wired into onboarding's "Enable Notifications" and a real Settings toggle (previously just static "Push notifications" caption text). SW `push`/`notificationclick` handlers added and confirmed present in the built bundle. **Genuinely unverified: the live "grant permission → subscribe → receive a push" round trip** — Chrome deliberately blocks any automation-dispatched click, real Chrome included, from satisfying the trusted-user-gesture requirement for the permission prompt (a structural security boundary, not a bug to chase — see `.agent-room/decisions.md`). No regression confirmed for NK-07 (SW still registers, offline fallback still works after the `sw.ts` changes). Needs a human to click "Enable Notifications" once to close this out. | M |
| NK-10 | Done | Vercel Cron → daily reminder | `vercel.json` + `/api/cron/daily-reminder`, `CRON_SECRET`-authenticated, idempotent (a new `daily_prompt_last_sent_date` column, since Vercel's own docs warn cron delivery can duplicate or miss). Scoped to exactly "daily reminder" — playback-ready/manifestation push-sending remain unbuilt, a real separate gap (their `notification_prefs` toggles exist but nothing sends for them). Verified end-to-end against a local Supabase stack with a real generated EC keypair: auth rejection, idempotency, and the stale-subscription (404/410) cleanup path all confirmed via an actual network round-trip to Google's FCM endpoint — not mocked. Found and fixed two real bugs while verifying, not just narrated: `src/proxy.ts` had no `/api/cron` exception, so Clerk would have redirected every real cron invocation to `/sign-in` before it ever reached the `CRON_SECRET` check — the job would have silently never fired in production; and the `service_role` Postgres role had zero table grants on this locally-replayed schema (a new `0008_grant_service_role.sql`, narrowly scoped, not a blanket grant). Sends once daily at a single fixed UTC time (20:00), **not** each user's individually configured `daily_prompt_time` — Vercel Hobby cron is capped at once/day with ±59min imprecision (confirmed against Vercel's current docs before designing this), so true per-user scheduling isn't achievable without a paid plan. A real, stated product gap, not silently glossed over. | S |
| NK-11 | Done | Offline app-shell caching | Fell out of NK-07 as expected: `defaultCache` (from `@serwist/turbopack/worker`) is Serwist's recommended Next.js runtime-caching strategy set, and the real-Chrome test that confirmed NK-07 — reload a previously-visited page with the server dead — is exactly this. Also makes Smart Search's 34MB model cache behave predictably rather than depending on browser Cache API heuristics alone (§10.6.7). | S |
| NK-12 | Done | Entry length cap | §10.6.4. Decided: 10,000 characters (~2,000 words), hard stop via `maxLength` — matches `ManifestationForm`'s existing capped-input pattern rather than a novel UX. `ENTRY_MAX_LENGTH`/`truncateToEntryLimit` in `src/lib/entryLimits.ts` (TDD'd). Enforcement is two-layered, deliberately, because the two layers protect different things: the composer's `maxLength` is the primary one and the only one that can be *dynamic* (in append mode it's `10,000 − existing text length`, so a thought added in three sittings can't creep past the cap piece by piece) — but entries are stored as ciphertext the server never decrypts, so `maxLength` is a client-side promise, not a guarantee. The real cost the roadmap item cares about materializes specifically in `/api/ai/playback` and `/api/ai/detect-signals` — the two routes that *do* receive real plaintext, transiently, per §6.4/§6.5 — so those now truncate defensively before the OpenAI call, independent of whether the client-side cap was ever bypassed or an entry predates this change. A live "X / 10,000" counter appears only past 80% combined length, not on every entry — the cap is meant to be invisible for ordinary journaling. | S |
| NK-13 | Done | Aggregate spend ceiling | §10.6.3(c). Decided: $1/day (real production pricing verified against OpenAI's current published rates, not recalled), configurable via `AI_DAILY_SPEND_CEILING_USD`, covering all four `/api/ai/*` routes including transcribe (needed a new migration — Whisper bills by audio duration, not tokens, which `ai_usage_log` didn't track). `checkAggregateSpendCeiling` (`src/lib/ai/usage.ts`) sums real cost across every user for the current UTC day and gates all four routes, degrading per-route rather than uniformly: `prompt` silently serves a static fallback (no error — a daily prompt is low-stakes enough not to need a degraded-mode message), `detect-signals` silently returns no signals (already best-effort, fire-and-forget), `playback`/`transcribe` — both explicit user actions — surface a distinct, honest message ("temporarily paused... check back tomorrow" / "try typing instead") rather than a generic failure. Requires the service-role client for a genuine cross-user read; found and fixed the exact same class of infrastructure gap as NK-10/NK-16 while verifying against a real local Supabase instance — `service_role` had zero grants on `ai_usage_log` (`0012_grant_service_role_ai_usage_log.sql`, `select`-only, matching that writes still go through the normal per-user client). Verified against real seeded rows, not assumed: zero-usage under ceiling, small usage under ceiling, usage crossing $1 *across two different users* correctly trips it (confirming this is a true aggregate, not per-user), whisper-1's duration-based pricing computed to the cent, a lower configured ceiling tripping sooner, and `service_role` genuinely rejected on a write attempt. | M |
| NK-14 | Partially done | Real-device embedding validation | §10.6.10's own stated caveat had two parts: Node-vs-browser inference speed, and retrieval at 1,000+ entries — both now measured for real, in a real browser, against the app's actual shipped code path (`docs/spikes/embedding-performance/RESULTS.md`). 1,005 entries indexed end-to-end via the real "Enable Smart Search" flow: ~590ms/entry steady-state (full pipeline — decrypt+embed+encrypt+IndexedDB write, not embed alone; not directly comparable to the quality spike's 7.4ms embed-only Node figure), ~11 minutes total including a one-time ~35s model download. Retrieval at 1,005 entries: ~1.9s average across 3 real queries (measured in-page via `performance.now()`, not across separate tool calls, after this session's own established finding that cross-call round-trip overhead would otherwise contaminate the number — see `.agent-room/decisions.md`), all three semantically correct despite deliberately vocabulary-disjoint queries. Surfaced and fixed a real, concrete finding along the way: `search/page.tsx`'s onboarding copy claimed "search is instant" — measurably false at this scale, reworded to a claim that stays true regardless of entry count. **Genuinely still open:** a real low-end phone. This session's tools have no physical device access and no CPU-throttling capability to approximate one — device-tier extrapolation remains unmeasured, stated plainly rather than assumed from these numbers. | M |
| NK-15 | Later | Self-host the embedding model | §10.6.9. A core feature currently depends on the HuggingFace CDN at runtime. Deferred deliberately until there is an offline story to integrate with — i.e. after NK-07/NK-11. | M |
| NK-16 | Done | Append to today's entry | Resolved as a narrower feature than general editing, per an explicit user request: multiple thoughts in a day become one entry, not several separate ones. Entries gained a real update path (`PATCH /api/entries/[id]`, today-only, server-enforced) — old text stays read-only, new text is appended with a blank-line separator, mood replaces, tags merge. §10.6.2's warning came true and was fixed: `buildNarrativeCacheKey` now hashes `(id, updated_at)` pairs, not bare entry IDs. Also fixed a signal-detection duplicate-row risk and a previously-undiscovered `authenticated`-role grant gap in the local Supabase instance (same class as NK-10's `service_role` gap, one layer up). Design: `docs/plans/2026-08-24-append-to-todays-entry-design.md`; plan: `docs/plans/2026-08-24-append-to-todays-entry-plan.md`. | L |
| NK-17 | Later | Multi-device search continuity | §10.6.8, an accepted limitation. A device paired via QR sync starts Smart Search from zero and re-embeds the whole archive. Fine at 50 entries, punishing at 2,000. | L |
| NK-18 | Later | Non-English retrieval validation | §10.6.10. The spike used 20 standard-English entries. Colloquial and non-English journaling is exactly the register people write in privately. | M |
| NK-19 | Later | Prompt personalization | `generateDailyPrompt` is called with an always-empty entries array, so all users on a tone share one generic prompt. Personalizing improves the daily hook but collapses the cache that makes it nearly free (§10.2) — a deliberate economics tradeoff, not a bug. | M |
| NK-20 | Done | Mobile FCP/LCP: 7.03s → self-hosted, subsetted Material Symbols | Vercel Speed Insights (production, mobile, last 7 days) showed Real Experience Score 56 ("Needs Improvement"), FCP and LCP both 7.03s (red) — while TTFB was 0.34s (green), meaning the ~6.7s gap was entirely client-side rendering delay, not server slowness. Root cause: `layout.tsx` loaded Material Symbols via a synchronous, cross-origin `<link rel="stylesheet">` straight to `fonts.googleapis.com`/`fonts.gstatic.com`, on every page, bypassing `next/font`'s self-hosting entirely (the other four fonts already used it correctly) — a genuine render-blocking third-party round trip, plus the *entire* Material Symbols family (3.96MB) for the ~77 icons this app actually uses. Fixed by self-hosting via `next/font/local`, and — since ligature-based subsetting barely helped (6597→5851 glyphs; the shared contextual-substitution graph pyftsubset has to close over pulls in most of the font regardless of how few icon names are referenced) — subsetting by exact Unicode codepoint instead: 3.96MB → 66KB, verified via `pyftsubset --unicodes=`. `MaterialIcon.tsx` now renders a looked-up PUA character (`src/lib/materialSymbolsCodepoints.ts`) instead of literal ligature text. Verified live: build output contains zero `fonts.googleapis.com` references, and every icon across Home/Journal/Settings/Manifestations/Playback/About renders correctly at both 1x and 4x zoom. A secondary, smaller lever noted but not taken here: 7 files still use raw `<img>` instead of `next/image` (flagged by `next/next/no-img-element`, pre-existing warnings) — real, but the images involved are small (10–34KB) and TTFB/CLS were already good, so this wasn't the dominant cause. | M |
| NK-21 | Done | Home LCP: 5.7s → skeleton placeholders for "Recent Thoughts" | Follow-up to NK-20 against fresh production data (RES climbed to 62 after NK-20; FCP 3.89s, LCP still "Poor" at 5.49s P75). This time route-level breakdown was available: `/` (Home) measured 5.7s ("Poor"), `/sign-in` 3.89s ("Needs Improvement"), `/about` and `/write` already "Great" (under 2.5s) — ruling out a shared-bundle-weight cause, confirmed directly by diffing `/`'s and `/write`'s generated `<script>` tags (19 vs 19, nearly identical). Root cause instead: `src/app/(app)/page.tsx`'s "Recent Thoughts" section rendered zero entries while `useEntries()` was loading (`(entries ?? []).slice(0, 3)` — an empty array, not a placeholder), then three brand-new blocks of decrypted text entered the DOM at once once the `/api/entries` round trip resolved. Per how LCP candidacy works, a text-only update inside an already-painted element doesn't count, but new elements entering the DOM do — making that late insertion the likely actual LCP element, and disproportionately costly on `/` specifically since it's the app's landing page and thus more likely than `/write`/`/journal` to hit a cold (unwarmed) React Query cache. Fixed with `RecentThoughtSkeleton`, sized to match the real entry block's padding/line-height exactly, shown while `entriesLoading` is true instead of nothing. Verified live (preview mode, with a temporary artificial delay on the fixture fetch to actually observe the loading window, reverted after): skeleton renders correctly on first paint, swaps to real content with no visible layout jump once data resolves. | S |
| NK-22 | Done | FCP: preconnect to Clerk's Frontend API | Follow-up to NK-20/NK-21 against fresh production data (RES 62; FCP itself still "Poor" at 3.89s P75). Route breakdown: `/sign-in` was the worst FCP route among ones with real sample counts (3.89s, "Poor"; `/sso-callback` showed 8.44s but on a single sample, too little to read into). Root cause: Clerk's JS SDK loads from `clerk.creator-ai.in` (a dedicated Frontend API subdomain — see `src/proxy.ts`'s DNS-CNAME note) via an async `<script>` Clerk itself injects, with zero resource hint ahead of it — confirmed by curling production directly. A genuine third-party origin with no existing connection costs real DNS+TLS setup time before the browser can even start the request. Fixed with `ReactDOM.preconnect()` (not a plain `<link rel="preconnect">` — that was tried first and, despite rendering, landed *after* Clerk's own script tag in the actual SSR HTML output, confirmed by inspecting the build directly; per Next's own docs, the dedicated `ReactDOM.preconnect`/`ReactDOM.preload`/`ReactDOM.prefetchDNS` APIs are what `next/font`/`next/script` use internally for correct head-priority placement, and a bare declarative link doesn't get the same treatment). `src/components/ClerkPreconnect.tsx`, mounted in `layout.tsx`. Verified by rebuilding and directly inspecting the generated HTML: the hint now lands at position 1 in `<head>`, before every script including Clerk's own (previously position 32, after it). Live no-regression pass across Home/About confirmed no console errors introduced. | XS |

## 4. Open decisions

Owner calls, not engineering decisions. Recorded here so they're decided deliberately
rather than by default.

### 4.1 How do you learn anything after launch?

The app runs no analytics of any kind, and the Privacy Policy states that plainly as
a promise. That is a real differentiator — and it means launching with **zero
feedback signal**. You will not know whether anyone finishes onboarding, whether
Smart Search is ever enabled, or whether playback is the retention hook it's assumed
to be.

This is the highest-leverage unresolved question here, because every Phase 3 priority
is a guess without it.

**Recommendation:** a small design-partner cohort (5–10 people who know they're early
and talk to you directly) rather than instrumentation. Preserves the privacy claim
exactly as written, and qualitative depth beats funnel metrics at this stage.

### 4.2 Are entries immutable on purpose? — decided

Today they cannot be edited — not a stated design stance, just the shape of what was
built. Both readings were defensible: an uneditable journal is philosophically
coherent (you don't get to revise your past), and an editable one fixes typos and
half-finished thoughts.

**Decided:** neither, exactly — append-only. NK-16 resolved this: multiple thoughts
in a day become one entry via a same-day append, not full editing of past entries or
past text. Entries gained their first update path (`PATCH /api/entries/[id]`,
today-only, server-enforced), and the §10.6.2 cache-staleness trap this section itself
flagged did get sprung by it, exactly as predicted — and was fixed in the same change
(`buildNarrativeCacheKey` now hashes `(id, updated_at)` pairs). Written down in
`ARCHITECTURE.md` §8 and §10.6.2, and in `.agent-room/decisions.md`'s 2026-08-25 NK-16
entry, per this section's own recommendation.

### 4.3 Notification richness vs. lock-screen exposure — decided

The original mockups show descriptive previews — the manifestation type went
furthest, quoting the actual subject of a real journal entry
(*"Your March entry about presenting with confidence — worth a look"*) directly on
the lock screen. A journaling app doing that is a privacy failure the encryption
architecture does nothing to prevent.

**Decided:** generic for all three notification types, no exceptions, no opt-in
toggle to unlock richer previews for now — see `docs/ARCHITECTURE.md` §8 for the
exact copy. An opt-in toggle was considered and deliberately deferred rather than
rejected outright: build it only once real usage shows people actually want it,
not speculatively ahead of anyone using the app. This was NK-08 and unblocks
NK-09/NK-10.

### 4.4 What does "launch" mean here?

There is no stated target — public launch, private beta, or personal-use tool. The
three imply materially different bars: NK-06 and NK-13 barely matter for a tool you
alone use, and are non-negotiable for anything public.

**Recommendation:** private beta with the cohort from §4.1. Makes Phase 0 the entire
launch bar and defers Phase 2's cost work honestly, since ten known users cannot
generate a surprise OpenAI bill.

## 5. Explicitly not doing

Scope discipline is a deliverable. These are declined, not forgotten.

- **Live-streaming voice transcription.** Already judged and rejected in §6.5. Batch
  transcription works; the Realtime API is a materially larger swap for a marginal gain.
- **Server-side passphrase recovery.** Requested by every user who ever loses one, and
  permanently incompatible with the product's central claim (§8). The answer is no,
  and stays no.
- **Social, sharing, or streak mechanics.** `content/about.md` explicitly promises no
  streak-shaming and no manufactured urgency. Growth features that contradict
  published copy cost more than they return.
- **Native iOS/Android apps.** §3's stack rationale chose a PWA specifically to avoid
  app-store review. Revisit only if Web Push on iOS proves insufficient in Phase 1 —
  a measurable outcome, not a hunch.

## 6. Definition of launch-ready

Phase 0 plus Phase 1. Shipping before every box is ticked means shipping a product
that contradicts its own marketing copy.

- [x] **No data-loss path.** Killing the tab mid-entry and reopening restores the draft.
- [x] **Crypto is tested.** Round-trip, both unwrap paths, and tamper detection pass in CI.
- [x] **CI blocks bad merges.** Typecheck, lint, and build all run on every PR.
- [x] **Failures are visible.** Sentry integrated (NK-06), active only in
      real production. *One honest caveat: the SDK's transport request
      wasn't directly observed completing during this session's
      verification (capture mechanism, config, and real network
      connectivity to Sentry's endpoint were each independently
      confirmed instead) — worth a first real check of the dashboard
      after this deploys.*
- [ ] **It installs.** Home-screen install works on iOS and Android — *the shell
      opening offline is confirmed (NK-07/NK-11), and iOS Add to Home Screen is
      now confirmed on a real device (the user installed it and used it in
      standalone mode — surfaced the auto-lock-on-backgrounding gap this
      session, itself real-device evidence the install actually works, not
      just that it's technically possible). Android Add to Home Screen
      remains untested.*
- [ ] **Reminders arrive.** An opted-in user receives a real scheduled push on a real device
      — *the send mechanism itself is confirmed working (NK-10, verified against a real
      network round-trip to Google's FCM endpoint); what's left is the human step from
      NK-09 (granting permission once) plus a real cron-triggered delivery to that
      subscription.*
- [x] **The data layer is typed.** Generated Supabase types, not the placeholder.
