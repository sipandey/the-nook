# The Nook — Product Backlog & Roadmap

Status: assessed 2026-08-24 against `main` @ `fe19e8a`.

**Since assessed:** NK-01 (composer draft persistence) shipped — the first
contradiction in §1's table below is resolved. Left as-is rather than rewritten,
since it's an honest record of state at assessment time; §3's backlog row and §6's
checklist are the current-status source of truth.

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
| NK-02 | Blocker — partial | Test suite for `lib/crypto/` | Written: `src/lib/crypto/index.test.ts` (Vitest, 14 tests) covers encrypt/decrypt round-trip, DEK wrap/unwrap under both passphrase and recovery code, tamper/wrong-key/wrong-passphrase/wrong-salt rejection, and export/import round-trip — each failure-mode assertion verified to actually fail red against a deliberately broken source before being trusted. Passes locally (`npm test`). Still blocking until NK-04 wires it into CI — a test suite nothing runs isn't a safety net. | M |
| NK-03 | Blocker | Generate real Supabase types | `src/lib/supabase/types.ts` is still the loose placeholder — no compile-time column checking anywhere. Needs Docker + project link (see `web/README.md` setup step 3). | S |
| NK-04 | Blocker | CI that builds the app | The only workflow validates the agent-room scaffold. Add `tsc`, `eslint`, `next build`, and now `npm test` (NK-02's suite exists but nothing runs it in CI yet) on every PR. | S |
| NK-05 | Blocker | Fix standing lint errors | Two `<a>`-instead-of-`<Link>` errors in sign-in/sign-up cause full page reloads on the auth path. Trivial; invisible today because CI never lints. | XS |
| NK-06 | Blocker | Production error monitoring | No visibility into production failures at all. A crash in unlock or decrypt is silent today. Must exclude entry content from payloads. | S |
| NK-07 | High | Register the service worker | Serwist is a dependency but appears nowhere in `src/` or `next.config.ts`. `manifest.json` and all icon sizes already exist, so remaining work is registration + an app-shell caching strategy. | M |
| NK-08 | Decision | Notification content policy | Blocks NK-09. Generic text vs. rich lock-screen previews is a privacy-posture call, not an engineering one. Open in §8. | — |
| NK-09 | High | Web Push subscription flow | VAPID keys are already in `.env.example`; nothing consumes them. Users can configure preferences today that are guaranteed to do nothing. | M |
| NK-10 | High | Vercel Cron → daily reminder | The actual trigger behind the reminder feature. Small once NK-07 and NK-09 exist; meaningless before them. | S |
| NK-11 | High | Offline app-shell caching | Falls out of NK-07. Also makes Smart Search's 34MB model cache behave predictably rather than depending on browser Cache API heuristics alone (§10.6.7). | S |
| NK-12 | Decision | Entry length cap | §10.6.4. Manifestations cap at 200 chars; entries have no `maxLength`. Playback and signal detection both send full text to OpenAI, so cost per call is unbounded. A journaling app capping length is a genuine UX constraint — needs a product call, not just a constant. | S |
| NK-13 | High | Aggregate spend ceiling | §10.6.3(c), explicitly left open. Existing limits bound calls per user per hour, not total dollars across all users. `ai_usage_log` already records token counts, so the data to build it exists. | M |
| NK-14 | High | Real-device embedding validation | §10.6.10's own stated caveat: the spike measured Node's ONNX backend on 20 entries. Browser WASM speed on a low-end phone, and retrieval at 1,000+ entries, are both unmeasured. Smart Search could be unusable on the devices most users have. | M |
| NK-15 | Later | Self-host the embedding model | §10.6.9. A core feature currently depends on the HuggingFace CDN at runtime. Deferred deliberately until there is an offline story to integrate with — i.e. after NK-07/NK-11. | M |
| NK-16 | Decision | Entry editing — or deliberate immutability | Entries have no update path; schema and API support only insert and delete. This may be a *feature* rather than a gap. If editing ships, §10.6.2 warns the playback narrative cache key silently goes stale and must be revisited. | L |
| NK-17 | Later | Multi-device search continuity | §10.6.8, an accepted limitation. A device paired via QR sync starts Smart Search from zero and re-embeds the whole archive. Fine at 50 entries, punishing at 2,000. | L |
| NK-18 | Later | Non-English retrieval validation | §10.6.10. The spike used 20 standard-English entries. Colloquial and non-English journaling is exactly the register people write in privately. | M |
| NK-19 | Later | Prompt personalization | `generateDailyPrompt` is called with an always-empty entries array, so all users on a tone share one generic prompt. Personalizing improves the daily hook but collapses the cache that makes it nearly free (§10.2) — a deliberate economics tradeoff, not a bug. | M |

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

### 4.2 Are entries immutable on purpose?

Today they cannot be edited — not a stated design stance, just the shape of what was
built. Both readings are defensible: an uneditable journal is philosophically
coherent (you don't get to revise your past), and an editable one fixes typos and
half-finished thoughts.

**Recommendation:** decide, then write it down in `ARCHITECTURE.md` §8 either way.
The cost of leaving it implicit is that §10.6.2's cache-staleness trap gets sprung by
whoever eventually adds editing without reading that far.

### 4.3 Notification richness vs. lock-screen exposure

The original mockups show descriptive previews. A journaling app pushing *"Three
weeks ago you wrote about your father"* to a lock screen anyone nearby can read is a
privacy failure the encryption architecture does nothing to prevent.

**Recommendation:** generic by default ("Time to reflect"), with an explicit opt-in
for richer text. Defaults are the real policy; most people never change them.

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
- [ ] **Crypto is tested.** Round-trip, both unwrap paths, and tamper detection pass in CI.
- [ ] **CI blocks bad merges.** Typecheck, lint, and build all run on every PR.
- [ ] **Failures are visible.** Production errors reach you without a user reporting them.
- [ ] **It installs.** Home-screen install works on iOS and Android; the shell opens offline.
- [ ] **Reminders arrive.** An opted-in user receives a real scheduled push on a real device.
- [ ] **The data layer is typed.** Generated Supabase types, not the placeholder.
