# Decisions Log — journal

Short, append-only record of architecture/design decisions and why. A
decision belongs here if a future session (or a future you) would otherwise
have to re-derive it from scratch by reading git history.

## Format

```
### YYYY-MM-DD — short title

**Decision:** what was decided.
**Why:** the constraint or trade-off that drove it.
**Rejected:** what else was considered, and why it lost.
```

<!-- Entries go below this line, newest first. -->

### 2026-08-22 — Dev-only preview mode instead of a real test account, for visual QA

**Decision:** Built `web/src/lib/preview.ts` — a client-side fixture layer (real AES-GCM-encrypted fixture entries/manifestations, decryptable by a fixed local preview DEK) plus bypasses in `proxy.ts` (skips `clerkMiddleware()` entirely, not just `auth.protect()` inside it — the dev-instance browser-handshake redirect happens inside `clerkMiddleware()` itself before any callback runs) and `UnlockGate.tsx` (auto-unlocks with the preview DEK). Every data hook (`useEntries`, `useManifestations`, `useKeyMaterial`, `useNotificationPrefs`, the Home daily-prompt query, `usePlaybackNarrative`) short-circuits to fixture data instead of fetching when the flag is on. Off by default; only activates with `NEXT_PUBLIC_PREVIEW_MODE=1` set explicitly at build/run time — never persisted as "1" in any committed file.
**Why:** The user asked for "some way to bypass auth to test all pages," but creating a real Clerk account (even via Clerk's own test-mode flow) is off-limits regardless of who asks — it's a standing rule, not a per-request judgment call. A dev-only fixture/bypass layer gets the same practical outcome (every screen reachable and populated for visual QA) without creating any real account or touching real Clerk/Supabase data.
**Guard detail:** the flag's safety check first used `NODE_ENV !== "production"`, but `next start` sets `NODE_ENV=production` even for local runs (this sandbox's Turbopack dev-mode has a known crash, so `next start` is the standard local verification path here) — that check would have silently blocked preview mode during the very verification that was needed. Swapped to `!process.env.VERCEL_ENV`, which is genuinely unset locally and only set on real Vercel deployments.
**Not faked:** write mutations (save entry, save manifestation, delete, notification-pref changes) still hit the real API routes and correctly fail with no session in preview mode — only *reading* is mocked, so the screens are honestly "view-only" in this mode rather than pretending saves work.


### 2026-08-22 — Settings (34-38) rebuilt from Stitch; kept Clerk's real UserProfile instead of the mockup's fake editable fields

**Decision:** Reskinned `settings/page.tsx` (home), `settings/passphrase/page.tsx` (already had accurate copy, kept it), `settings/account/page.tsx` (Clerk wrapper), and extracted Export and Delete Account from their old inline-expand UI into two new dedicated routes (`settings/export/`, `settings/delete-account/`) matching the "Data Export" and "Delete Account" mockups. Two specific mockup elements were not carried over as designed: (1) "Account & Sign-In" showed hardcoded editable email/display-name fields, a fake password-update row, a fake 2FA toggle, and fake Google/Apple connect/disconnect buttons — none backed by real Clerk calls. Kept the existing real `<UserProfile/>` embed (handles password, 2FA, sessions, and connected accounts for real) and only reskinned the frame + tinted Clerk's own `appearance` variables, per the brief's own instruction ("lighter-touch wrapper... not necessarily Clerk's internals"). (2) "Data Export" offered a PDF-vs-JSON format radio; `exportUserData()` only produces JSON (no PDF generation exists), so the format section shows JSON as the one real option instead of a picker with a non-functional PDF choice.
**Why:** Same "no fake affordances" principle applied all session — editable fields and toggles with no backing mutation would either silently do nothing or need new Clerk API work out of scope for a reskin.
**Also fixed:** "Local-Only" copy → "End-to-End Encrypted" in the settings home, export, and delete-account screens. The delete-account mockup's erasure list ("local device data and synced cloud backups") was replaced with what's actually deleted: entries, manifestations, and encryption keys/recovery phrase — the real scope of `DELETE /api/account`.
**Clerk appearance note:** `UserProfile`'s `appearance.variables` type in the installed SDK version only accepted `colorPrimary`/`colorBackground`/`borderRadius` — `colorText`/`colorTextSecondary` aren't in its `Variables` type despite existing on other Clerk component appearance types (e.g. PaymentElement); trimmed to the accepted subset rather than guessing further.


### 2026-08-22 — Manifestations (30-33) rebuilt from Stitch, kept the real cadence values over the mockup's

**Decision:** Rebuilt `manifestations/page.tsx` (card list + empty state) and `ManifestationForm.tsx` (add/edit + inline delete) from the 4 Stitch screens. The "Add/Edit Manifestation" mockup's cadence radios are Daily/Weekly/Monthly, but the real `Cadence` type (`useManifestations.ts`) is `"weekly" | "monthly" | "ai_decides"` — there's no daily option and no schema value for one. Kept the real three options, styled as the mockup's radio-circle pattern rather than adopting invalid values.
**Why:** "Daily" isn't a value `useSaveManifestation` accepts; shipping it as a UI option with no matching backend state would either silently no-op or require a schema change out of scope for a screen reskin.
**Also fixed:** "Local-Only encrypted" / "Local-Only Processing" copy in the list, empty state, and form footer → "End-to-End Encrypted", same recurring fix as every other Stitch batch this session.


### 2026-08-22 — Playback (23-29) rebuilt from Stitch, skipped two mockup elements with no real backing

**Decision:** Rebuilt `playback/page.tsx` (hub + empty state) and `playback/story/page.tsx` (mood trend, highlight, compare, letter, loading) from the 7 Stitch screens in project `13778589545983828422`. Two things from the mockups were deliberately NOT built: (1) the hub's "Year in Review — locked, write X more entries" section and the empty state's "2/3 progress toward your first recap" bar — the app has no minimum-entry threshold before a recap generates (even 1 entry triggers `usePlaybackNarrative`), so a fake progress/lock UI would imply a rule that doesn't exist; (2) the "Playback Story - Future Letter" mockup is actually a compose-and-schedule INPUT screen ("Dear future me...", "Seal & Send", "Sealed until next month") for a feature that doesn't exist (no scheduled-delivery storage, no unlock-date mechanism). Kept the existing `letter` card as a DISPLAY of the AI-generated retrospective letter (`narrative.data.letter`), reskinned to the mockup's atmospheric dark aesthetic, with its "Write to future self" CTA still linking to the real `/write` composer — not a fake "Seal & Send" button.
**Why:** Same "no fake affordances" principle as the last several passes — a progress bar or lock icon implies a real gate; a "Seal & Send" implies a real scheduled-delivery feature. Neither exists, so showing them would misrepresent the product.
**Also fixed:** every mockup's "Local-Only Processing" copy (in the mood-trend and loading screens) → "End-to-End Encrypted", consistent with every other privacy-copy fix this session — mood/story generation genuinely calls OpenAI server-side, so "local" is false.
**Kept as designed:** the then-vs-now comparison card's conditional appearance (only renders when `findComparisonPair` finds real data) already meant the progress-bar segment count naturally shrinks when it's absent — exactly the "fewer segments" behavior the brief asked to design, no new code needed for that part.


### 2026-08-22 — Composer states (18-22) rebuilt from Stitch, real save-error retry instead of the mockup's fake offline queue

**Decision:** Rebuilt `write/page.tsx` (text entry, saved confirmation, save-error) and `VoiceRecorder.tsx` (recording, transcribing) from the 5 Stitch screens in project `13778589545983828422`. The mockups' privacy copy ("Local-Only Encryption", "Audio processed locally", "Your audio stays on your device") was replaced with accurate copy: "End-to-End Encrypted" for saved entries (matches the rest of the app), "Processed securely, never stored" for the transient recording (Whisper API call, not persisted). The "Composer - Save Error State" mockup implies an offline-first architecture — autosaved locally, "Retry Sync" / "Keep Local Only" buttons, a persistent word-count/last-saved footer — none of which exists; the real save path is a single POST to `/api/entries` with no local persistence. Built the error card with the same visual language (icon, headline, description, action button) but wired the button to actually retry `handleSave()`, and dropped "Keep Local Only" entirely since there's nothing for it to do.
**Why:** Every "Local-Only" claim in these mockups is false for this app — ciphertext leaves the device to Supabase, and Whisper transcription is a real server call. Shipping fake offline/sync UI would either mislead the user about what the app does or require building real offline persistence, which is out of scope for a screen reskin.
**Rejected:** Adding a fake "Keep Local Only" button that does nothing, or implementing real offline autosave to make the mockup's copy true — both rejected as scope the user didn't ask for; flagging real offline support as a possible future feature is more honest than faking its UI now.


### 2026-08-22 — Home/Journal/Entry (12-17) rebuilt from Stitch, kept real composer and honest encryption copy over the mockup's shortcuts

**Decision:** Rebuilt Home (populated + empty), Journal list (populated + empty + no-search-results), and Entry detail (reading view + inline delete) from the individual Stitch screens ("Home - Daily Reflection", "Home - Empty State", "Journal - Archive", "Journal - Empty & Search State", "Entry Detail - Reading View", "Entry - Delete Confirmation" — all in project `13778589545983828422`, found via `get_project`'s full `screenInstances` list since `list_screens` only surfaces one representative screen per named group). Kept the real `/write` composer as the entry point for new entries rather than the mockup's inline textarea-in-the-prompt-card pattern, and used "End-to-End Encrypted" instead of the mockups' "Local-Only" / "Local-Only Encryption" copy throughout.
**Why:** The mockups' inline "type your reflection right in the prompt card" pattern has no tags, no mood-dot picker, no voice entry, and no save-confirmation screen — adopting it literally would have meant losing real, already-built composer functionality to match a static comp. "Local-Only" is inaccurate: entries are encrypted client-side but the ciphertext still goes to Supabase, and AI prompt/playback generation genuinely calls OpenAI server-side — the app's own established privacy copy ("End-to-End Encrypted") says what's actually true without overclaiming.
**Rejected:** Copying entry titles from "Entry Detail - Reading View" (mockup shows a headline separate from body) — rejected because entries don't have a separate title field in the data model (write/page.tsx concatenates an optional title into the body text itself), so faking a distinct headline would require fragile re-parsing of stored plaintext.


### 2026-08-22 — Unlock/sync screens (8-11) reskinned to the new palette, kept the real pairing flow instead of the mockup's fake approval gate

**Decision:** Reskinned `PassphraseUnlock.tsx`, `DeviceSyncPanel.tsx`, `QrCode.tsx`, and `settings/device-sync/confirm/page.tsx` to the sage/terracotta editorial system (they'd been left on the plain pre-migration sage tokens until now). Did NOT implement the Stitch "Unlocking & Syncing" mockup's state 4 ("Approval Required" — Approve/Deny buttons, fake location/device metadata) or its state 2 recovery UI (four 4-digit segmented boxes for a "16-digit code").
**Why:** The real device-sync flow (`src/lib/deviceSync.ts`) uploads the DEK automatically the moment the already-unlocked device opens the scanned link — there's no server-side approval step to gate, so an "Approve/Deny" button would be a fake affordance implying a security check that doesn't exist (violates the UX brief's "no fake affordances" rule directly). Recovery is a 12-word phrase from a curated wordlist (see the wordlist decision from earlier in this project), not a 16-digit numeric code, so the segmented-box UI didn't match what the crypto actually produces.
**Rejected:** Building the mockup's approval gate as real UI backed by a fake "always approve" no-op — rejected because it would misrepresent the security model to the user, which is exactly the kind of trust-critical honesty the brief calls out explicitly.


### 2026-08-22 — Migrated the whole app from the black-primary Playfair system to sage/terracotta "Sanctuary"

**Decision:** Stitch project 13778589545983828422 (Onboarding & Authentication) used a completely different palette/type system than every screen built so far this session — sage-green primary (`#4a654e`), terracotta secondary (`#99452c`), Newsreader (serif) + Hanken Grotesk (sans) instead of the earlier black-primary (`#000003`) Playfair Display/Public Sans system. Asked the user how to reconcile the two; they chose a full migration. Implemented it as a token-only swap: `layout.tsx` now loads Newsreader/Hanken Grotesk instead of Playfair Display/Public Sans, and `globals.css`'s `--color-*` values under the "editorial design system" block were repointed to the new hex values — same token *names* (`primary`, `on-surface`, `surface-container-lowest`, etc.), new values. Also added `--text-headline-md`/`--text-label-sm` and `--spacing-inline-gap`/`--spacing-stack-gap`/`--spacing-container-padding` tokens the new mockups use that the old scale didn't have.
**Why:** Every screen built after the "formalize design tokens" decision already used semantic Tailwind classes (`bg-primary`, `text-on-surface`, `font-editorial-display`) rather than literal hex — so repointing the token *values* re-themes the entire app (Home, Write, Manifestations, Playback, Settings, Journal, etc.) without touching those files individually. The screens still holding literal hex (`sign-up/page.tsx`, `PassphraseSetup.tsx`, Home's `EmptyHome`) had to be rewritten by hand since they wouldn't have picked up the new palette otherwise — now fixed too, so no arbitrary-hex "editorial" screens remain (verified via `grep -rl "bg-\[#\|text-\[#\|border-\[#"`).
**Rejected:** Keeping the old black-primary system and restyling only the 7 new onboarding screens to match it — rejected per explicit user instruction to migrate project-wide, not scope the new palette to onboarding alone.
**Note:** `PassphraseUnlock.tsx` and `journal`'s original hooks-only screens were never migrated to the black-primary "editorial" system in the first place (they're still on the original plain sage `--color-bg`/`--color-accent` tokens from before this whole design-system effort started) — they're unaffected by this migration and remain a separate, older visual layer. Worth a follow-up pass if full consistency matters.

### 2026-08-22 — Lock-screen notification mockup implemented as an in-app preview, not a real device-frame route

**Decision:** The brief's "Lock-screen push notification appearance (device-frame mockup)" was built as a collapsible in-context preview inside `/onboarding/notifications` (`NotificationPreview` component — same 3 notification copy/icons as the Stitch mockup) rather than a standalone Next.js route rendering an iOS-style device frame.
**Why:** A real OS lock screen can't be rendered by a web app — the Stitch mockup is a static design reference (phone bezel, notch, wallpaper chrome), not a live, revisitable app screen. A dedicated route for it would be dead-end content nobody reaches through normal navigation. An in-context preview delivers the same information ("here's what these will look like") as a real, reachable piece of UI.
**Rejected:** A literal `/onboarding/lock-screen-preview` route with a hardcoded phone-frame mockup — rejected as orphaned, unreachable content that doesn't serve the actual product.

### 2026-08-22 — AI tone selection and notification permission built as new `/onboarding/*` routes, not wired into the signup→home redirect chain

**Decision:** Built `/onboarding/tone` and `/onboarding/notifications` as real, functional standalone routes (using `useTone`/`useNotificationPrefs`, the same hooks Settings uses) rather than modifying the app's auth/unlock gating logic to auto-chain sign-up → passphrase → tone → notifications → Home.
**Why:** Wiring a first-run sequence touches the app shell's gate component (wherever `PassphraseSetup`'s `finish()` currently hands off to the main app) — out of scope for "update these screens from Stitch," which asked for the screens, not a rearchitected onboarding flow. Building them as real reachable routes (not static mockups) keeps them genuinely useful now and makes wiring the redirect chain later a small, isolated change.
**Rejected:** Modifying the gating logic to force this sequence on every new signup — rejected as a bigger, riskier change than what was asked; flagged as a natural follow-up instead.


### 2026-08-22 — Built Phase 3 (Home populated, Journal list, Entry detail) directly from design tokens, without new Stitch mockups

**Decision:** `generate_screen_from_text` against the `stitch` MCP server timed out twice in a row for a new "Home (populated)" screen, and neither attempt registered a new screen in `list_screens`/`list_screens` (verified — screen count and titles unchanged before/after both calls). Rather than keep retrying a tool that isn't completing, built the three Phase 3 screens (`web/src/app/(app)/page.tsx` populated state, `web/src/app/(app)/journal/page.tsx`, `web/src/app/(app)/journal/[id]/page.tsx`) directly against the same design-system tokens already in `globals.css` (ported from the same Stitch project's DESIGN.md in an earlier decision), instead of waiting on/re-attempting generation.
**Why:** The tool's own guidance says not to blindly retry a timeout — poll `get_screen` instead — but polling needs a screen id, and no screen id was ever produced. Blocking further work on an MCP call that isn't completing wasn't worth it when the design system itself (colors, type scale, spacing) was already fully available and already the source of truth for every other screen built this session.
**Rejected:** Continuing to retry `generate_screen_from_text` — rejected after 2 timeouts with zero new screens registered, to avoid burning more calls on a request that shows no sign of completing. If `stitch` needs to be used again, check `list_screens` for a stray generation before assuming it's just slow.

**Also note:** the editorial `BottomTabBar` (see the design-tokens decision above) doesn't include a dedicated tab for `/journal` (the list) — its "Journal" tab routes to `/write`, matching every mockup's 4-item nav (Home/Journal=compose/Playback/Manifest). `/journal` is reached via a "View all" link added to Home's Recent Entries section instead.


### 2026-08-22 — Download the Stitch hero illustrations as static assets instead of hotlinking or hand-drawing

**Decision:** Pulled the two "rolling hills" illustrations (dawn: sage/terracotta, dusk: indigo/violet) directly from the connected Stitch MCP project and saved them permanently as `web/public/images/hero-dawn.jpg` / `hero-dusk.jpg`, then wired them into Write's composer header fade, VoiceRecorder's background, Playback hub's hero card, and Home's empty-state circle — replacing the hand-drawn SVG stand-ins built earlier in this session.
**Why:** Earlier passes avoided the mockups' `lh3.googleusercontent.com/aida/...` URLs because they read as temporary AI-preview links not fit to embed in shipped code. The Stitch MCP connection (`claude mcp add stitch ...`) gives direct, permanent access to the same generated images, so downloading them once into `public/images/` gets the exact design-canvas art without hotlinking a third-party CDN at runtime.
**Rejected:** Kept using the hand-drawn SVG hills (`CircularHillsIllustration`, the plain gradient in Playback's hero card) — rejected once the real assets were available, since the user explicitly asked for the same images as the Stitch screens, not an approximation.


### 2026-08-22 — Formalize the editorial design tokens instead of continuing arbitrary Tailwind values

**Decision:** Ported the full Material-3-style color/type/spacing token set from
`design/updated/the_nook_design_system/DESIGN.md` into `web/src/app/globals.css`'s
`@theme inline` block (surface/primary/mood/etc. colors, the display/headline/body/
label type scale, spacing units), instead of continuing to hardcode arbitrary
Tailwind values (`bg-[#f9f9f7]`, `text-[18px]`, ...) per screen as the earlier
signup/passphrase/home-empty screens had done.
**Why:** This session redid six more screens (Write, Manifestations, Playback hub +
story, Settings) all sharing the same design system doc — real tokens meant `bg-surface`,
`text-title-md`, etc. instead of re-typing the same hex/px literals in every file, and any
future palette tweak only needs one edit.
**Rejected:** Kept the old sage-theme `--color-*` tokens in place rather than replacing
them (both systems coexist in `globals.css`); the one deliberate collision is
`--color-surface`, where the new editorial value (`#f9f9f7`) now wins over the old sage
value (`#ffffff`) since the two are visually near-identical and full separation wasn't
worth the naming complexity.

### 2026-08-22 — Playback hub/story stay dark ("Cinematic Night Mode") regardless of system theme

**Decision:** `playback/page.tsx` and `playback/story/page.tsx` render on the
`night-bg`/`night-surface` dark palette unconditionally, with their own inline bottom
nav, rather than following the light editorial theme used by Home/Write/Manifestations/
Settings or toggling with the OS color scheme.
**Why:** Matches `design/updated/playback_hub` and `playback_story_highlight`, which are
explicitly dark-mode mockups (`DESIGN.md`'s "Cinematic Night Mode" for playback/re-reading
entries) — and the story page was already dark-themed (`#2c3a2c`) before this pass, so
this keeps that established pattern rather than introducing a new light-vs-dark toggle.
**Rejected:** Making Playback follow the shared light `BottomTabBar`/token set like the
other rebuilt screens — rejected because the mockups treat Playback as a distinct mode,
not a themed variant of the same screen.

### 2026-08-24 — Daily-prompt cache: Postgres table + DB-constraint single-flight, no CDN caching

**Decision:** Added `prompt_cache` (`supabase/migrations/0004_prompt_cache.sql`), keyed
on `(tone, cache_date, template_version)`, and made `/api/ai/prompt` check it before
calling OpenAI and insert on a miss. `cache_date` is UTC calendar date, chosen explicitly
rather than left ambiguous. Concurrency at day rollover is handled by the table's own
unique constraint — a losing concurrent insert gets Postgres error `23505` and re-selects
the winning row instead of generating a second time — not application-level locking.
Explicitly did **not** add `Cache-Control: public, s-maxage=...` for CDN/edge caching,
despite that being the cheaper option and part of the original proposal.
**Why:** The prompt route is gated by a Clerk `auth()` check returning 401 for anonymous
callers. A CDN-level cache hit never re-invokes the origin function, so a publicly
cacheable response on an authenticated route would let a cached hit skip that check
entirely — turning an authenticated endpoint into an unauthenticated read path for
anyone, not just signed-in users. Caught this during implementation, after already
having proposed the CDN approach in `docs/ARCHITECTURE.md` §10.2 — corrected the doc
alongside the code rather than leaving the stale recommendation in place. Chose a plain
Supabase table over Vercel KV/Upstash for the cache store itself because the stack
explicitly avoids new backend vendors (`docs/ARCHITECTURE.md` §3, §10.6.5) and this
table needs no more than point lookups by primary key.
**Rejected:** CDN/edge caching (auth-bypass risk, above). A KV/Redis-backed cache
(faster reads, but a new vendor for a workload — daily-prompt lookups — that doesn't
need sub-millisecond latency). Per-user local-date cache keys (would preserve exact
timezone correctness but collapse the ≤4-calls/day win down to roughly one entry per
timezone-offset × tone instead of 4 total) — accepted the UTC-boundary tradeoff instead.

### 2026-08-24 — Rate limiting + usage logging reuse one table, checked only on cache miss

**Decision:** Added `ai_usage_log` (`supabase/migrations/0005_ai_usage_log.sql`) as a
single table serving two purposes: an audit trail (one row per completed AI call —
route, model, token counts, timestamp; never content) and the data source for rate
limiting (`checkAiRateLimit` in `src/lib/ai/usage.ts` counts a user's rows for a route
within a trailing window instead of maintaining a separate counter table). Wired into
all four `/api/ai/*` routes: `checkAiRateLimit` runs immediately before the OpenAI call
(after any cache lookup), `recordAiUsage` runs immediately after a successful call.
Changed `generateDailyPrompt`, `generatePlaybackNarrative`, `detectManifestationSignals`,
and `transcribeAudio` in `src/lib/ai/openai.ts` to return `{ result, usage }` instead of
bare content, so token counts surface to the route handlers without `openai.ts` itself
taking on any DB/auth dependency.
**Why:** A single log-table-as-rate-limiter avoids a second new artifact (an atomic
counter table) for what fixed-window rate limiting actually needs — a row count over
recent time, which this app's scale doesn't need sub-millisecond latency for. Checking
the limit only on a cache miss (specifically in `/api/ai/prompt`) matters: a cache hit
costs nothing, so counting it against a limit meant to bound OpenAI spend would be
wrong. Keeping usage/DB concerns out of `openai.ts` preserves the separation already
established between it (talk to OpenAI, return content) and the route handlers (who is
this for, should we let them) — mirrors where `auth()` already lives.
**Rejected:** A separate atomic counter table with upsert-on-conflict increments —
more "correct" under high concurrency, but this app has no concurrency at the scale
that would matter, and it's a second table for no real benefit over counting the usage
log. A global/aggregate spend ceiling (sum of token cost across all users) — deferred;
what's built bounds per-user call *count*, not aggregate *dollar* cost, and sizing a
dollar ceiling before any real usage data exists would be guessing. Both functions fail
open (a DB error allows the call / skips the log write) rather than fail closed —
chosen so a logging/rate-limit bug degrades to "occasionally under-limits," never to
"blocks legitimate use of the app."

### 2026-08-24 — Embedding-quality spike validated client-side search; use MiniLM-L12, not L6

**Decision:** Ran the spike sequenced in `docs/ARCHITECTURE.md` §10.5 step 3: embedded
20 realistic journal entries and ran 12 deliberately vocabulary-disjoint search queries
against two candidate models (`Xenova/all-MiniLM-L6-v2`, `Xenova/all-MiniLM-L12-v2`) via
`@huggingface/transformers`, run standalone in Node (isolated `package.json`, not added
to `web/package.json`). Results and methodology committed at
`docs/spikes/embedding-quality/` (`RESULTS.md`, `run.mjs`, `entries.mjs`). L12 hit 100%
top-3 / 75% top-1 retrieval; L6 was noticeably worse (83% top-3, one near-total miss).
Recorded the verdict as **go** for client-side semantic search (§10.3 option A), and
recorded **L12, not L6** as the model to build against, updating §10.4/§10.5/§10.6.10.
**Why:** §10.6.10 explicitly required this spike to have a real answer before any
storage schema or search UI gets built — building either first would mean discovering a
quality problem after committing to a schema, not before. L12 over L6 specifically
matters because L6 is the smaller/more commonly-defaulted-to model in transformers.js
examples and tutorials; picking it without testing would have been the natural default
and the wrong one for this data — the near-total miss on "quitting a job" (ranked 12th
of 20 candidate entries) shows L6's semantic matching genuinely breaks down on realistic
queries, not just performs slightly worse.
**Rejected:** Larger models (e.g. a MiniLM variant beyond L12, or a non-MiniLM
architecture) — not tested, since L12 already hit 100% top-3 on the test set; chasing
further quality on a small, deliberately-hard 12-query set would be optimizing past the
point the spike can actually measure. OpenAI-embeddings fallback (§10.3 option B) — not
needed given L12's result; would have added real per-entry OpenAI cost for a quality gap
that turned out not to exist in this test. Keeping the spike's dependency
(`@huggingface/transformers`) out of `web/package.json` — it's throwaway validation
tooling, not shipped code; the real client-side embedding lib (still unbuilt) is a
separate, deliberate addition to the app's actual dependencies when that work starts.

### 2026-08-24 — Built Smart Search: opt-in-by-first-use, no separate settings flag

**Decision:** Built `/search` (`src/app/(app)/search/page.tsx`) and its supporting lib
(`src/lib/search/`: `vectorStore.ts` for encrypted IndexedDB storage,
`embed.worker.ts` running `Xenova/all-MiniLM-L12-v2` per the validated spike,
`useEmbeddingWorker.ts` for the request/response protocol, `useSemanticSearch.ts` for
orchestration). Added `@huggingface/transformers` to `web/package.json` for real this
time (the spike's copy stayed isolated in `docs/spikes/`). Rather than a separate
Settings toggle, "opted in" is inferred directly from whether the user's IndexedDB
vector store is non-empty — the first tap of "Enable Smart Search" on `/search` both
starts indexing and IS the opt-in; there's no separate preference to fall out of sync
with actual index state. Entry point is a link on the Journal list page, next to the
existing keyword search bar. Worker only gets constructed on the first `embed()` call
(not on `/search` page load), so visiting the page before tapping "Enable" never
triggers the model download. Vectors are `encryptText`/`decryptText`'d with the DEK
(same primitives as entry content) before ever touching IndexedDB — no code path writes
a raw vector to disk. On each `/search` load, entries present but not yet indexed
(added since the last visit) are embedded automatically in the background — the initial
opt-in covers future entries too, not just the ones that existed at opt-in time.
**Why:** A settings-table-backed toggle would need to stay in sync with actual
IndexedDB contents (what if indexing failed partway, or IndexedDB was cleared by the
browser?) for no real benefit — deriving "enabled" from the store's own contents can't
drift from reality by construction. Lazy worker construction and the explicit
opt-in-with-size-disclosure screen directly implement §10.6.7's requirement that
visiting the app, or even visiting `/search`, must never trigger an unannounced ~34MB
download. Encrypting vectors before storage implements §10.6.6, treated as
non-negotiable per that section, not an optional hardening pass added after the fact.
**Rejected:** A Settings-page toggle for enabling/disabling search — rejected per above
(state-sync risk, no benefit over inferring from the store). Sending decrypted entry
text to the worker for it to also handle IndexedDB reads/writes — rejected to keep the
worker scoped to exactly one job ("turn text into a vector"), mirroring how
`src/lib/ai/openai.ts` stays scoped to "talk to OpenAI" and never touches
auth/DB/storage; encryption and storage both stay on the main thread, where the DEK
already lives. Pruning cached vectors when their entry is deleted — rejected as
unnecessary complexity: search results are always intersected with the live entries
list before rendering, so a stale vector for a deleted entry can never surface, it's
just inert until the next full index clear.

### 2026-08-24 — Playback narrative cache: same encrypt-before-storage posture as search

**Decision:** Added `src/lib/playback/narrativeCache.ts` — an IndexedDB store, one
database per user, keyed by a SHA-256 hash of `(period, tone, sorted entry ids)` — and
wired it into `usePlaybackNarrative`: check cache before calling `/api/ai/playback`,
write to cache after a successful generation. The narrative is `encryptText`/
`decryptText`'d with the DEK before it ever touches IndexedDB, matching
`vectorStore.ts`'s posture exactly. Also changed `usePlaybackNarrative` so preview mode
(`src/lib/preview.ts`) routes through the real cache-check/decrypt/encrypt path around
its fixture narrative instead of short-circuiting past it entirely — mirrors
`useSemanticSearch`'s `PREVIEW_MODE ? "preview-user" : ...` pattern. Verified live: the
IndexedDB store held exactly one AES-GCM-encrypted entry (not plaintext JSON) after a
first visit to a story, reused that same entry (still exactly one key) on a reload of
the same period, and produced a second, distinct key when the period changed — cache
hit, cache miss, and key derivation all confirmed working, not just built.
**Why:** `PlaybackNarrative.highlightQuote` is a verbatim quote lifted from a real
entry, not an abstract vector — if anything more sensitive than a search embedding, and
squarely what `docs/ARCHITECTURE.md` §5 point 2 already calls out ("AI-generated output
derived from plaintext is itself sensitive... does not get a free pass just because the
AI produced it"). Treating it as encryption-optional would have been inconsistent with
the search cache built earlier this session. Making preview mode exercise the real path
rather than bypass it was necessary to actually verify the cache functions in a browser
at all — `getPreviewPlaybackNarrative()` is synchronous and would otherwise return
before the mutationFn ever reached the cache-check code.
**Rejected:** A server-side cross-device cache (`playback_cache` Supabase table,
mentioned as a follow-up in §10.2) — out of scope for the client-side cost win this was
built for; each device now builds its own cache independently, an accepted gap
documented in §10.2, same shape as §10.6.8's multi-device search limitation. Skipping
encryption on the grounds that IndexedDB is local-only and never touches the network —
rejected per the "Why" above; local-only doesn't mean not sensitive, per the same
reasoning already established for vectorStore.ts.

### 2026-08-24 — Clerk production Frontend API proxy set explicitly, not via SDK auto-detection

**Decision:** Wired up Clerk's `/__clerk` Frontend API proxy (needed to move Clerk to a
production instance without a dedicated `clerk.*` DNS subdomain) with explicit code in
both `src/proxy.ts` (`clerkMiddleware(handler, { frontendApiProxy: { enabled: true } })`)
and `src/app/layout.tsx` (`<ClerkProvider proxyUrl="/__clerk">`), rather than leaving it
to `@clerk/nextjs`'s built-in Vercel auto-detection. Both are gated on the publishable
key actually starting with `pk_live_` (checked via a plain string prefix, not an
internal SDK helper — none of `isProductionFromPublishableKey` or similar is exported
from the public `@clerk/nextjs/server` surface), so local dev's `pk_test_` key is
untouched.
**Why:** Read the installed SDK source (`node_modules/@clerk/nextjs@7.8.0/dist/esm/
server/clerkMiddleware.js` and `@clerk/shared/dist/proxy.js`) rather than trust generic
docs, since getting Clerk's own auth flow wrong isn't a survivable "we'll fix it later"
bug. Found that `@clerk/nextjs` *does* auto-detect this proxy setup from Vercel's own
env vars — but only client-side (`ClerkProvider`'s `mergeNextClerkPropsWithEnv`), and
only when `process.env.VERCEL_TARGET_ENV === "production"`. The server-side middleware
half auto-detects independently, based on request hostname at runtime, with no such
environment restriction. If live keys were ever put on a Preview deployment too (a real
possibility — nothing stops it), the client half would silently fail to activate there
while the server half would still expect proxied requests, breaking sign-in on preview
branches in a way that would work fine locally and in Production, and be genuinely
confusing to debug. Explicit config removes that whole class of environment-dependent
behavior.
**Rejected:** Relying on the SDK's Vercel auto-detection as documented/intended —
rejected specifically because of the Production/Preview asymmetry above, not because
auto-detection is unreliable in general. Gating on an internal SDK helper
(`isProductionFromPublishableKey`) instead of a plain string check — not worth an
import from a path that isn't part of the package's public API surface for something
this simple and stable (Clerk's `pk_live_`/`pk_test_` prefix convention). Applying
`frontendApiProxy`/`proxyUrl` unconditionally (not gated on key type) — rejected because
it would route local dev's `pk_test_` traffic through the same proxy path unnecessarily,
a behavior change to an environment this task wasn't asked to touch.

### 2026-08-24 — Unified BottomTabBar (green active state); Write composer gets header/footer

**Decision:** Eliminated Playback's two inline, hand-copied bottom-nav blocks (one per
light/dark state) in favor of the shared `BottomTabBar` component, extended with a
`variant: "light" | "dark"` prop matching `AppHeader`'s existing pattern. Standardized
the active-tab highlight on `bg-primary-container`/`text-on-primary-container` (green)
everywhere — the three prior implementations disagreed (`secondary-container`/peach in
`BottomTabBar`, `primary-container`/green in both of Playback's inline copies) — and
standardized label typography to plain `text-label-sm` (dropping
`uppercase tracking-wider` from the original `BottomTabBar`, which Playback's copies
never had). Also fixed a real bug found while comparing the three copies: all three
labeled a tab "Journal" but linked it to `href: "/write"` (the composer) instead of
`/journal` (the list) — tapping "Journal" in the bottom nav never actually opened the
journal list. Separately, gave the Write composer's text stage a standard `AppHeader`
+ `BottomTabBar` in place of its bespoke X-close/"New Entry" header and lack of any
footer nav, matching every other (app)-group screen.
**Why:** Three independent copies of the same nav had drifted in exactly the ways a
shared component prevents — color, typography, and even a broken link, silently, for
however long "Journal" pointed at the wrong route. Green over peach because that's the
explicit design direction given (theme-matching), and because Playback's own two
copies had independently already converged on green, suggesting it was already the
intended color and `BottomTabBar` (peach) was the outlier, not the other way round. The
Write composer's custom header made sense in isolation but reads as "this screen is a
different kind of thing" once every sibling screen (Home, Journal, Manifestations,
Playback, Settings) shares one header/footer language — consistency was the explicit
ask, not a judgment call.
**Rejected:** Keeping Playback's inline navs and just recoloring them to match — passed
over because the underlying problem (three copies of one component) would still exist
and drift again the next time anyone touched one copy and not the others; the `/write`
vs `/journal` bug is direct evidence that already happened once. Keeping a close/X
button on the Write composer's header for explicit escape — dropped in favor of relying
on `BottomTabBar`'s Home/Journal links, consistent with how every other non-modal
screen in the app already expects the user to navigate, and per the user's explicit
"ensure consistency" instruction rather than preserving the modal-style affordance.

### 2026-08-24 — Added four public legal/marketing pages, outside auth entirely

**Decision:** Added `/about`, `/encryption`, `/privacy`, `/delete-my-data` as new routes
directly under `src/app/` (siblings to `sign-in`/`sign-up`, not inside the `(app)` route
group), added all four to `isPublicRoute` in `src/proxy.ts`, and built a small shared
`PublicPageHeader`/`PublicPageFooter` (`src/components/PublicPageChrome.tsx`) rather than
reusing `AppHeader`/`BottomTabBar`. Linked them from the sign-in page's footer. Privacy
Policy content is grounded directly in `docs/ARCHITECTURE.md` §5/§6 (verified against the
actual schema and `src/app/api/account/route.ts`'s real deletion order, not written from
a generic template) and names the one real exception to "we never see your plaintext" —
transient AI-feature plaintext exposure to OpenAI — explicitly rather than glossing over
it. Contact email (sipandey.sape006@gmail.com) confirmed with the user rather than
invented; asked before writing anything, since a wrong or placeholder contact/entity in a
privacy policy is worse than not having the page yet.
**Why:** `AppHeader` assumes a signed-in visitor (it links to Settings, and its lock icon
implies "your journal is currently unlocked" in the first person) — wrong tone and wrong
functionality for a pre-signup visitor. Placed outside `(app)` specifically so `UnlockGate`
never wraps them — a legal page requiring a journal passphrase to unlock would defeat the
purpose of a legal page. Grounding the Privacy Policy in the actual codebase (real table
names, the real deletion order, the real third parties: Clerk/Supabase/OpenAI/Vercel, and
confirming no analytics/tracking library exists before claiming none is used) matters
because a privacy policy is a factual claim people may rely on, not marketing copy —
getting a detail wrong here is a different order of problem than a wrong detail in UI
copy.
**Rejected:** Guessing at a business entity name, address, or compliance-framework
claims (e.g. asserting GDPR compliance) — none of that exists to draw from in this repo,
and inventing it would be worse than omitting it; the policy names jurisdictions
generically ("if you're in a jurisdiction with...") rather than claiming a compliance
status. Building these as Settings-only, authenticated pages — rejected per explicit user
direction and because privacy/deletion information genuinely needs to be reachable by
someone who hasn't signed up, or who's locked out and wants to know how to request
deletion without an account.

### 2026-08-24 — Public-page copy moved to Markdown, via a hand-rolled ~250-line renderer, not a library

**Decision:** Extracted all four public pages' prose out of JSX and into `web/content/*.md`,
read at request time via literal-path `fs.readFileSync` calls (one function per file in
`src/lib/content.ts`, not a single `readContent(slug)` taking a variable — see that
file's comment on why: Vercel's serverless file-tracing isn't reliable for
dynamically-interpolated paths, only literal ones). Rendered via a new
`src/components/MarkdownContent.tsx` — a dependency-free parser/renderer scoped to
exactly the Markdown subset these four pages use (`#`/`##`/`### N. Title` headings,
`> ` blockquotes that recursively re-parse their own contents, ordered lists, `**bold**`/
`` `code` ``/`[text](url)` inline, with internal links routed through `next/link` and
`mailto:` links getting an automatic mail-icon prefix), not a general CommonMark
implementation or a markdown library dependency. A few things stayed as fixed JSX rather
than moving into Markdown: Privacy's "Last updated" line (document metadata, not prose),
and each page's trailing icon+text branding row (chrome, not content) — content and
chrome are different things and only one of them needed to move.
**Why:** User asked to move page text out of components into separate,
easier-to-edit files. Four static pages didn't justify a real Markdown library as a new
dependency — the actual syntax in play (headings, one level of blockquote nesting, bold,
code, links, ordered lists) is small and stable enough that a scoped parser is both less
code AND a smaller, more auditable surface than pulling in a general one. The literal-path
`fs` requirement is a real Vercel deployment gotcha, not theoretical — a dynamic path
argument to `readFileSync` can silently fail to be included in the traced serverless
bundle, which would only surface as a production-only "file not found" that never
reproduces locally; worth the one-function-per-file boilerplate to avoid.
**Rejected:** A general Markdown library (`react-markdown`, `marked`, etc.) — would have
handled more syntax than these four files need, at the cost of a new dependency and less
control over exactly how each element maps to this app's existing Tailwind design tokens.
A single `readContent(slug: string)` helper — simpler to write, but the dynamic-path
file-tracing risk made the per-file-literal version worth the extra boilerplate. Moving
*everything* including the "Last updated" date and branding footer into Markdown — passed
over because those aren't prose that changes with the same cadence or for the same
reasons as the actual page copy; forcing them through the same pipeline would have meant
either complicating the parser for one-off cases or losing the ability to make one a
computed value (the date) and the other a shared fixed element.

### 2026-08-24 — Real brand logo, sourced from Stitch, replaces the placeholder icons

**Decision:** The app's favicon/app icon (`src/app/icon.png`, `apple-icon.png`) and the brand mark shown
in `PublicPageChrome`'s header and the sign-in/sign-up hero are now the actual "The Nook"
logo (leaf-in-arch glyph), pulled from the Stitch design project
(`projects/13778589545983828422/screens/d2398cea54fb4acaa564307eadc52629`, "The Nook
Abstract Sanctuary Logo") instead of a generic Material Symbols "eco" leaf standing in for
it. Two derived assets live in `public/brand/`: `logo-full.png` (the full square badge,
used as-is for `icon.png`/`apple-icon.png`) and `logo-mark.png` (the glyph alone, no
wordmark, transparent background, recolored to `--color-primary` (#4a654e) instead of the
mockup's lighter sage so it matches the text it sits next to).
**Why:** User asked to "apply the logo at other places" after the favicon-only pass, and
to get Stitch to regenerate a transparent-background version of just the glyph for that —
the original asset is a flattened square card with the wordmark and a solid cream
background baked in, unusable inline next to existing "The Nook" text without duplicating
it.
**How it was extracted:** Stitch's `edit_screens` was asked to isolate the glyph on a
transparent background, but it returns a JPEG (no alpha channel), so "transparent" came
back as a literal baked-in checkerboard pattern, not real alpha. Recovered actual
transparency by chroma-keying in Python/Pillow: the checkerboard cells are pure
grayscale (R==G==B) while the line art has a real green tint, so any pixel with
`G - R > threshold` and `G - B > threshold` became opaque (filled with the fixed brand
color), everything else transparent — with an explicit row-range exclusion for a faint
horizontal ghost-text artifact band that shared the same tint and would otherwise have
survived the color filter.
**Left untouched, deliberately:** the "eco" icon still appears bare (unswapped) in three
spots — the home screen's streak indicator, the playback story loading pulse, and
`AppHeader`'s lock icon — because those aren't brand-mark placements (they're a
streak/growth indicator and a functional "encrypted" status icon), and two of them use
theme-dependent color classes (`text-primary-fixed`, dark-mode variants) that a
fixed-color raster glyph can't follow the way `currentColor` does.
**Rejected:** using `next/image` for the new `<img>` tags — the codebase doesn't use
`next/image` anywhere else (existing images, including `QrCode.tsx`'s generated code, are
plain `<img>`), so matching the established pattern beat introducing it for one icon.

### 2026-08-24 — Roadmap lives in docs/ROADMAP.md, separate from ARCHITECTURE.md

**Decision:** Added `docs/ROADMAP.md` — a prioritized backlog (19 items), four gated phases, open
product decisions, an explicit not-doing list, and a launch-ready checklist — as a
sibling to `ARCHITECTURE.md` rather than a new section inside it. The split is along
**intent vs. state**: ARCHITECTURE.md describes what the product is meant to be and
stays true indefinitely; ROADMAP.md describes what is currently true of the build and
goes stale by design, so it carries a "assessed against `main` @ `<sha>`" stamp and
says outright that ARCHITECTURE.md wins on intent where the two disagree. Linked from
the root README's "Where to start" table so it's discoverable rather than buried.
**Why:** A roadmap folded into ARCHITECTURE.md would have made a document explicitly
described as "the source of truth" partly obsolete the moment any item shipped —
mixing durable and perishable content in one file is what causes docs to lose
authority. Keeping them separate means ROADMAP.md can be aggressively rewritten each
time priorities move without anyone worrying they're editing the spec.
**Two gaps this surfaced that weren't in any existing gap list:** (1) CI validates the
agent-room scaffold but never runs `tsc`, `eslint`, or `next build`, which is why two
`<a>`-instead-of-`<Link>` lint errors in sign-in/sign-up have sat unnoticed; (2)
`src/lib/supabase/types.ts` is still the loose placeholder, so the entire data layer
has no compile-time column checking. Both are recorded as NK-04/NK-03. `web/README.md`'s
known-gaps list stays as-is and is now the *feature*-level view, with ROADMAP.md
covering process and infrastructure gaps it never claimed to.
**Rejected:** a GitHub Projects board or issue tracker instead of a file — for a solo
builder, a file that reviews in the same diff as the code it describes beats a
separate system that drifts. Also rejected: including day-level time estimates;
XS/S/M/L relative sizes convey the same sequencing information without implying a
velocity that hasn't been measured.

### 2026-08-24 — NK-01: composer draft persistence, encrypted in IndexedDB

**Decision:** Built `src/lib/composer/draftStore.ts` (IndexedDB, one draft slot per
Clerk user, same open/get/put/delete shape as `playback/narrativeCache.ts` and
`search/vectorStore.ts`) and `src/lib/hooks/useComposerDraft.ts` on top of it, wired
into `src/app/(app)/write/page.tsx`. The draft is AES-GCM-encrypted with the DEK
before it touches disk — never plaintext at rest, matching the posture every other
DEK-derived cache in this codebase already holds. Autosave debounces 800ms after the
last keystroke; a `flushDraft()` path bypasses the debounce entirely and fires on
`visibilitychange` turning `hidden`, since a mobile OS can kill a backgrounded tab
well inside that window — verified in-browser by dispatching a synthetic
`visibilitychange` under 200ms after typing and confirming the encrypted write landed
in IndexedDB before any debounce timer could have fired. Restoring shows a dismissible
"Restored your unsaved draft" banner with a Discard action, rather than silently
repopulating the composer — the user should be able to tell "this is old, unsaved
work" from "this is what I'm currently typing."
**Why:** Roadmap item NK-01 (docs/ROADMAP.md), flagged as the sharpest contradiction
between the product's own claim ("a quiet place to write") and its actual behavior —
the composer held entry text in plain React state with zero persistence.
**Two real bugs found and fixed via `eslint-plugin-react-hooks` 7.1.1's new checks
(react-hooks/set-state-in-effect, react-hooks/refs), not by style preference:**
(1) the initial design exposed a `restoredDraft` state value for the page component to
mirror into its own title/text/mood/tags state via a `useEffect` — the classic
"adjust state when a value changes" shape the newer lint rule specifically targets.
Restructured so the hook takes an `onRestore` callback and invokes it once from
*inside* its own async restore IIFE (the same shape `useDecryptedMap.ts` already uses
successfully) — the setState calls never appear directly in an effect body, so the
problem is structurally avoided rather than the rule being suppressed. (2) A ref
tracking the latest draft values for the `visibilitychange` listener was written
directly during render (`ref.current = {...}` at the top level of the component body)
— moved into its own no-deps `useEffect` (runs after every render), the standard
React pattern for "always-fresh ref without violating render purity."
**Rejected:** keying the draft store by entry id / supporting multiple concurrent
drafts — the composer only ever has one in-progress entry at a time, so a single fixed
key (`"current"`) is correct, not a simplification that will need revisiting later.
Also rejected: silently restoring without any banner — considered, but a composer that
can silently repopulate with old text without explanation is confusing in exactly the
way NK-01 exists to prevent trust erosion, not just data loss.

### 2026-08-24 — NK-02: test suite for lib/crypto/, on Vitest

**Decision:** Added Vitest as the project's first test runner (`vitest.config.mts`,
`"node"` environment — no jsdom, since Node 22's global WebCrypto/`btoa`/`atob` cover
everything a pure-module test needs) and wrote `src/lib/crypto/index.test.ts`: 14
tests covering encrypt/decrypt round-trip (including unicode and empty string), fresh-IV-per-call,
tampered-ciphertext rejection, wrong-key rejection, mismatched-IV rejection, DEK
wrap/unwrap round-trip under both a passphrase and an independently-generated
recovery code (proving the dual-backup-path property, not just that unwrap works
once), wrong-passphrase rejection, wrong-salt rejection, export/import round-trip,
and `generateRecoveryCode`/`generateSalt`'s shape and randomness. Every "should
throw" assertion was verified to actually go red first: temporarily mutated
`deriveKeyEncryptionKey` to ignore its `secret` parameter, confirmed exactly the
"rejects unwrapping with the wrong passphrase" test failed (and only that one), then
restored the file from a backup and diffed it byte-identical before moving on — a
test suite is only as trustworthy as its failure modes, not just its passes.
**Why:** Roadmap item NK-02 (docs/ROADMAP.md) — `src/lib/crypto/` carries this
product's entire privacy claim ("technically unreadable to us") and had zero test
coverage anywhere in the repo, the sharpest of the three contradictions §1 of the
roadmap opens with.
**Chose Vitest over Node's built-in test runner:** `node:test` would mean zero new
dependencies, but Node 22's native TypeScript support (`--experimental-strip-types`)
doesn't resolve this repo's `@/*` path alias and is still experimental; Vitest's ESM/TS
support is first-class, config is ~15 lines, and it's the standard pairing for a
Vite-adjacent TS project — a better foundation for the component/hook tests this repo
will eventually need, not just this one file.
**Deliberately not tested:** Argon2id's internal tuning constants (iterations,
memory cost) — they aren't exported, and reaching into the module's private state to
assert on them would couple the test to an implementation detail a legitimate future
retune could change for good reason. Tested instead: the property that actually
matters, that derivation is a pure function of (secret, salt) — same pair always
works, changing either one doesn't (the wrong-salt test exists specifically to prove
salt is load-bearing, not decorative).
**Not yet done:** CI doesn't run `npm test` — that's NK-04's job, updated to say so
explicitly. A test suite nothing runs on a PR isn't actually a safety net yet; the
ROADMAP.md checklist item ("Crypto is tested... pass in CI") is deliberately left
unchecked until that lands.

### 2026-08-24 — NK-04: CI that builds the app, and why NK-05 had to land with it

**Decision:** Added `.github/workflows/app-ci.yml`: typecheck, lint, `npm test`,
then `npm run build`, on every push/PR to `main` — the existing
`agent-room-validate.yml` only ever validated the agent-room scaffold, never the
app itself. Added `web/.nvmrc` (22.20.0) and pointed `actions/setup-node` at it via
`node-version-file` — this repo had no pinned Node version anywhere before, which
is why this whole multi-session build repeatedly needed a manual `nvm use
22.20.0` (the sandbox default is Node 10.24.1, unusable for Next.js 16). Added a
`typecheck` script: `next typegen && tsc --noEmit`, not bare `tsc --noEmit` —
discovered that a bare `tsc --noEmit` fails on a fresh checkout with `Cannot find
name 'LayoutProps'` because Next.js's per-route generated types (under
`.next/types/`, which `tsconfig.json`'s `include` references) don't exist until a
build or `next typegen` has run at least once; `next typegen` generates just the
route types without a full build, so typecheck stays fast and independent of the
build step rather than only working by accident when `.next/` happens to already
exist locally. The build step needs a dummy `OPENAI_API_KEY` — verified by
building with a **fully empty environment** (`env -i`) first: it fails with
`Missing credentials` from `src/lib/ai/openai.ts`'s module-scope `new
OpenAI(...)`, called during page-data collection for the three `/api/ai/*`
routes; a single dummy key value fixes it, and Clerk/Supabase keys turned out not
to be required at build time at all.
**Why:** Roadmap item NK-04 — the only CI in the repo never ran `tsc`, `eslint`,
or `next build`, which is exactly why NK-05's two lint errors sat unnoticed and
why the `LayoutProps` typecheck gap above was invisible until this work
deliberately went looking for it.
**NK-05 (fix standing lint errors) had to land in the same change, not stay a
separate follow-up:** `npm run lint`'s real exit code (checked directly, not
through a piped `tail` — an earlier check in this same session was fooled by
exactly that) is `1` because of the two pre-existing `<a>`-instead-of-`<Link>`
errors. Wiring lint into CI without fixing them first would have shipped a CI
pipeline that's red from its very first run on a known, already-diagnosed,
two-line fix — not "CI that builds the app," CI that's broken on arrival. Fixed
both (`sign-in`/`sign-up` pages), verified via a real click-through in-browser
that both directions still navigate with zero console errors — and, separately,
that the *other* diagnosis method (piping through `tail` and reading `$?`
afterward) silently reports the wrong exit code, since `$?` then reflects `tail`,
not the piped command. Worth remembering for any future "did this actually pass"
check in this repo.
**Verified the whole pipeline end-to-end locally** — including `npm ci` (not
`npm install`) against the exact committed lockfile — before trusting any of this
in GitHub Actions, not just each command in isolation.

### 2026-08-24 — NK-03: real Supabase types, generated locally via Docker — no login needed

**Decision:** Replaced `src/lib/supabase/types.ts`'s loose placeholder with real
generated types. `web/README.md`'s own setup instructions said this needed the CLI
authenticated against the linked hosted project (`--project-id <id>`) — turned out
unnecessary: `supabase gen types` also has a `--local` mode that reads a local
Docker Postgres instance instead, and `supabase start` builds that local instance by
replaying `supabase/migrations/*.sql` from a stopped state, which requires no
`supabase login`/access token at all. Ran `supabase init` (committing the resulting
`supabase/config.toml` and `supabase/.gitignore`) → `supabase start` (Docker,
confirmed running) → `supabase gen types typescript --local` → `supabase stop`.
Diffed the 8 generated tables against the 8 `create table` statements across the
migrations — exact match, including the RLS helper function
(`requesting_user_id`) and every foreign key relationship. Re-ran the full CI
sequence (typecheck, lint, `npm test`, build) against the real types — all clean,
meaning the loose placeholder hadn't been silently masking any real mismatch
between the query builder calls across the codebase and the actual schema.
**Why:** Roadmap item NK-03 — the placeholder traded away compile-time column
checking on every Supabase query builder call in the app, the last open item in
Phase 0 (Integrity).
**A real mistake caught mid-task, not just narrated:** first attempt at `npx
supabase@2.115.0 --version` printed `6.14.12` and `gen types --help` produced
garbled, unrelated output (`readlink: illegal option`, references to a
`~/.gen/config` file) — because it ran without `nvm use 22.20.0` first, so npx
resolved everything under the sandbox's default Node v10.24.1 (`npm root -g`
pointed at the v10.24.1 tree), not the real Supabase CLI. This is the exact
"unusable default Node" trap this whole multi-session build has hit repeatedly —
now genuinely harder to hit again since NK-04 added `web/.nvmrc`, but still
possible for any command run outside `web/` or without sourcing nvm first.
**A second real mistake, caught before it shipped:** `supabase start` drops
vendored, minified Edge Runtime JS into `supabase/.temp/` — gitignored, but
ESLint doesn't read a nested `.gitignore` and has its own ignore list, so `npm run
lint` picked it up and reported 182 errors that had nothing to do with this
change (`no-var`, `prefer-const` against auto-generated single-line minified
code). Added `supabase/.temp/**` to `eslint.config.mjs`'s `globalIgnores` — a
real, generalizable fix, not just a one-time cleanup, since anyone who runs
`supabase start` locally after this would hit the same false-positive lint
failure otherwise.
**Left as a stated, not hidden, limitation:** because the local instance's schema
comes only from replaying the committed migrations, this can't detect drift from
a manual change made directly in the hosted project's dashboard (bypassing
migrations entirely) — noted explicitly in the new file's header comment, with
the `--linked`/`--project-id` regeneration path documented in `web/README.md` for
whoever eventually links the real project.
**Committed:** `supabase/config.toml` and `supabase/.gitignore` (from `supabase
init` — needed by any future `supabase start --local`, including CI if that's
ever added) alongside the regenerated types and the eslint config fix. Did not
commit `supabase/.temp/`, `.branches/`, or `snippets/` — ephemeral CLI runtime
state, cleaned up after `supabase stop` rather than left in the working tree.

### 2026-08-24 — NK-07: registered the service worker via @serwist/turbopack, not @serwist/next

**Decision:** Wired up Serwist (`web/next.config.ts` wraps the config in
`withSerwist`, `src/app/sw.ts` is the worker source, `src/app/serwist/[path]/route.ts`
serves the bundled script, `src/app/providers.tsx` mounts `SerwistProvider`
site-wide) using `@serwist/turbopack`, a package this repo didn't have installed —
**not** `@serwist/next`, the one already listed in `package.json`. Read
`@serwist/next`'s actual source (`node_modules/@serwist/next/dist/index.mjs`)
before writing any code: it only hooks into `nextConfig.webpack(...)`, and this
project's `dev`/`build` scripts run under Turbopack (confirmed by every build's
own `▲ Next.js 16.3.2 (Turbopack)` banner throughout this whole multi-session
build) — under Turbopack, that webpack hook is simply never called, so
`@serwist/next` would have silently registered nothing while looking wired up.
The package's own source prints an explicit dev-mode warning about exactly this
and names `@serwist/turbopack` as the fix. Verified the installed version
(`9.5.12`, matching the rest of the Serwist packages) actually exports the
`createSerwistRoute`/`withSerwist` API the docs describe — necessary because
`@serwist/turbopack`'s published docs site currently describes an unreleased
`10.0.0-preview` API surface that doesn't match what `npm install`'s version
range would actually resolve; fetched the real `examples/next-turbo-basic`
example from the `serwist/serwist` GitHub repo instead of trusting the docs site,
and confirmed its file layout (`app/sw.ts`, `app/serwist/[path]/route.ts`,
`tsconfig.json` adding `"webworker"` to the project-wide `lib` array rather than
scoping it to one file) against this installed version's actual dist output
before adapting it.
**Why:** Roadmap item NK-07 — Serwist was a dependency with nothing wired up;
`manifest.json` and all icon sizes already existed, so this closes the gap.
`/serwist(.*)` and `/~offline` added to `src/proxy.ts`'s public-route allowlist:
`SerwistProvider` mounts from the root layout (covers public pages like
`/sign-in`, not just the authenticated `(app)` group), and the SW's install-time
precache fetch for the offline fallback happens without Clerk session context —
gating either behind `auth.protect()` would mean an unauthenticated visitor can't
register a service worker at all, and the cached "offline" page would silently
become a cached sign-in redirect instead of the real fallback.
**Verification — initially incomplete, then confirmed live in real Chrome:** the
build succeeds and bundles a real 66-entry precache manifest; `/serwist/sw.js`
and `/~offline` both serve with correct headers (`Content-Type:
application/javascript`, `Service-Worker-Allowed: /`, no redirect — checked with
`redirect: 'manual'`). A first attempt at live `navigator.serviceWorker.register()`
failed in this session's automated Browser pane with Chromium's generic "unknown
error occurred when fetching the script," even though `read_network_requests`
confirmed the exact same fetch completed with a clean 200 at the network layer —
ruled out redirects and module-vs-classic worker type directly (both failed
identically), which pointed at a CDP-automation/service-worker-registration
interaction rather than the app, but wasn't conclusive on its own. Once Claude in
Chrome reconnected, the identical code was re-tested in a real, non-automated
browser and worked cleanly: registration reaches `activated`, `window.serwist`
exists, zero console errors. Went further than just registering — killed the
local `next start` process entirely (not a DevTools offline toggle) and
confirmed: (1) a page loaded once while the SW was active stays fully available
with the server dead (proves `defaultCache`'s runtime caching, i.e. NK-11, not
just registration), (2) a page never visited under an active SW correctly falls
back to `/~offline`. Unregistered the test SW and closed the tab afterward so no
stray registration was left pointed at localhost in the real browser profile.
**Confirms the automated-pane failure really was a tooling artifact, not a
latent bug** — worth remembering the next time a Serwist/PWA-adjacent check
fails only in that environment: don't conclude "broken" from the automated pane
alone if the failure mode is this specific (network-layer success, browser-API-
layer rejection) and a real-browser cross-check is available.
**Also added, low-risk/high-confidence, not blocked by the above:** a `viewport`
export in `layout.tsx` matching `manifest.json`'s existing `theme_color`
(`#4f6b52`) — two previously-independent declarations of the same intent, now
consistent.

### 2026-08-24 — NK-08: notification content is generic for all three types, no exceptions

**Decision:** All shipped push notification bodies stay generic, for all three
notification types (`daily_prompt`, `playback_ready`, `manifestation`), with no
per-type richness and no opt-in Settings toggle to unlock richer previews for
now. Exact copy (recorded as the canonical source in `docs/ARCHITECTURE.md` §8,
not just here): daily prompt → "Time to reflect"; playback ready → "Your weekly
playback is ready"; manifestation resurfaced → "A manifestation resurfaced."
Before asking the user to decide, pulled the actual mockup copy from
`design/mobile-flow/LockScreenNotifications.dc.html` rather than presenting the
question abstractly — the three types turned out to have meaningfully different
exposure levels in the original design, not a uniform "rich vs. generic" binary:
playback-ready's mockup text was already generic (no change needed); daily
prompt's mockup quoted the AI-generated prompt itself (a question, not personal
content); manifestation's mockup directly quoted the *subject of a real journal
entry* ("Your March entry about presenting with confidence — worth a look") —
the one type that actually leaked something a lock-screen glance shouldn't show.
Presented the user a type-aware option (generic only where the mockup actually
exposed content) alongside the simpler blanket-generic option; they chose
blanket-generic for all three anyway, favoring one simple rule over a policy
that would need explaining per notification type.
**Why:** Roadmap item NK-08 — this was correctly scoped as a product/privacy
decision only the user can make, not an engineering call; the previous pass
through this codebase (docs/ROADMAP.md's original assessment) explicitly flagged
it as open rather than guessing at an answer.
**Opt-in toggle for richer previews:** considered, not rejected — deliberately
deferred rather than built speculatively. The user's own reasoning: build it once
real usage shows people actually want it, not ahead of anyone using the app.
**Also fixed while in `docs/ARCHITECTURE.md` §8 anyway:** two other items in that
same "still open" list — offline write conflict handling, PWA installability —
had already been resolved by NK-01 and NK-07/NK-11 in earlier turns this session
but the doc was never updated to say so, exactly the kind of drift
`ARCHITECTURE.md`'s own header warns against. Updated both alongside the
notification item rather than leaving known-stale entries sitting next to the
one being fixed.

### 2026-08-24 — NK-09: Web Push subscription flow, mostly verified — one piece structurally can't be

**Decision:** Built the storage (`0006_push_subscriptions.sql` — keyed by
`endpoint`, not `user_id`, since one user can have several devices each with
their own subscription; NK-10's send job fans out to all of them), the API
(`/api/push-subscriptions` POST/DELETE), the client hook
(`src/lib/hooks/usePushSubscription.ts` — `useQuery` for status,
`useMutation`s for subscribe/unsubscribe, matching this codebase's established
data-hook shape rather than a hand-rolled `useState`/`useEffect` version), and
the service worker side (`push`/`notificationclick` listeners added to
`src/app/sw.ts` — not part of Serwist's own event set, so these are plain,
hand-rolled `self.addEventListener` calls). Wired into both places that
already existed but did nothing: onboarding's "Enable Notifications" button
(previously only saved boolean prefs, never actually requested permission —
wrapped the new `subscribeToPush` call in try/catch so a denied/skipped prompt
doesn't block finishing onboarding) and a new Settings toggle (previously just
a static "Push notifications" caption under the Playback Ready row, no control
at all).
**Why:** Roadmap item NK-09 — VAPID keys had sat unused in `.env.example`
since the schema was first scaffolded.
**Payload contract for NK-10** (documented in `sw.ts` itself, repeated here
since it's the seam between the two roadmap items): `{title, body, url?}`,
JSON-encoded. The handler renders whatever it's given verbatim — it's the
sender's job to only ever send the generic NK-08 copy, not something this
handler enforces.
**Migration required regenerating Supabase types again**, same process as
NK-03/NK-07: `supabase start` restored from a stale snapshot that predated
`0006_push_subscriptions.sql` (visible immediately — `\dt public.*` showed 8
tables, not 9), so used `supabase db reset` instead to force a full replay of
every migration, confirmed the table existed via direct `psql`, then
regenerated types and diffed the result against the raw CLI output
byte-for-byte (only the intentional header comment differed) before trusting
the edit.
**Genuinely unverified, and here's exactly why it can't be closed by more
automation effort:** attempted the live subscribe flow in real Chrome (via
Claude in Chrome, the same tool that correctly confirmed NK-07). Calling
`Notification.requestPermission()` — both directly via script and from inside
a `computer`-tool-dispatched click on a real, freshly-injected button — left
`Notification.permission` at `"default"` indefinitely; no prompt ever
resolved, and `chrome://settings/content/notifications` isn't reachable
through the automation surface to inspect why. This is not the same class of
problem as NK-07's initial false failure (a CDP-automation artifact that real
Chrome then contradicted) — it's a deliberate Chrome security boundary: an
extension-dispatched click, even in real Chrome, doesn't satisfy the
"unspoofable user activation" requirement permission prompts specifically
check for, precisely so no automation (malicious or otherwise) can auto-click
through a security-sensitive prompt on a user's behalf. No further retrying in
this environment will resolve it. What *is* confirmed: the built `sw.js`
bundle contains both the `push` and `notificationclick` listeners (checked via
`curl | grep` against the actual served file, not just the source), and
re-verifying NK-07's offline-fallback behavior after editing `sw.ts` showed no
regression — server killed, never-visited page still fell back to `/~offline`
correctly.
**What closing this out actually requires:** a human clicking "Enable
Notifications" (onboarding) or the Settings toggle once, for real. At that
point `web-push send-notification` (CLI, no app code needed) against the
resulting subscription and the real VAPID keys already in `.env.local` would
confirm live delivery — that verification step is still open, not attempted,
because there's no subscription to test against yet without that human click.

### 2026-08-24 — NK-10: daily-reminder cron, scoped to exactly "daily reminder"

**Decision:** Built `vercel.json` (one cron, `0 20 * * *`) and
`/api/cron/daily-reminder`: `CRON_SECRET`-authenticated (Vercel's own
documented pattern — automatically sent as `Authorization: Bearer
<CRON_SECRET>` when Vercel invokes the job), idempotent (a new
`notification_prefs.daily_prompt_last_sent_date` column — added
`0007_daily_reminder_tracking.sql` — since Vercel's own cron docs warn
delivery can duplicate or miss invocations, not something to discover in
production), fans out to every `push_subscriptions` row for a user (not
just one — a user can have several devices), and prunes a subscription on
a 404/410 send response the way `web-push`'s own documented convention
expects. Added a `getSupabaseServiceRoleClient()` alongside the existing
request-scoped one in `src/lib/supabase/server.ts` — the cron route has no
per-request Clerk session to scope a normal client to, since its entire
job is reading across *every* user's prefs and subscriptions, which a
user-token-scoped client structurally cannot do. Documented as the one
sanctioned exception to "never bypass RLS," restricted to exactly this one
route.
**Why:** Roadmap item NK-10 — the actual trigger behind the reminder
feature; `notification_prefs` already stored the preference and NK-09
already stored subscriptions, nothing sent anything.
**Deliberately narrow scope, stated explicitly, not implied:** this route
only ever sends the daily-prompt reminder. `playback_ready` and
`manifestation` both have toggles in `notification_prefs`/Settings but
have no send trigger anywhere in the app — real, separate, unbuilt work
(manifestation-signal push in particular would need to hook into
`/api/manifestation-signals`' detection flow, a different code path
entirely). Not doing that here would have silently made NK-10 look like
"notifications are done" when two of three types still do nothing.
**A real, load-bearing platform constraint, checked before designing, not
assumed:** fetched Vercel's current cron-jobs docs directly rather than
relying on memory. Confirmed: Hobby plan cron jobs are capped at once per
day, with ±59-minute imprecision, full stop — expressions that would run
more often fail at deploy time. This makes `notification_prefs.daily_prompt_time`
(a genuinely per-user, precise time the Settings UI lets someone
configure) structurally unhonorable on Hobby without a paid upgrade. Chose
a single fixed daily time (20:00 UTC, close to the schema's own
`20:30` default) sent to every enabled user regardless of their
individually configured time, and stated the gap plainly in
`web/README.md`'s known-gaps list and this roadmap row — not silently
implemented as if the per-user time were being honored.
**Two real bugs found and fixed while verifying, not just narrated:**
(1) `src/proxy.ts` had no exception for `/api/cron` — Clerk's
`auth.protect()` would have redirected every real Vercel Cron invocation
to `/sign-in` before the request ever reached the route's own
`CRON_SECRET` check, since a cron trigger carries no Clerk session at all.
The job would have silently never fired in production; this only surfaced
because the route was actually curled end-to-end rather than trusting the
CRON_SECRET check in isolation. Fixed the same way `/api/webhooks` already
handles this (a route with its own non-Clerk auth mechanism belongs in the
public-route allowlist). (2) The local Docker Postgres instance's
`service_role` role had zero table grants on *any* table in the schema,
not just the new ones — `BYPASSRLS` (which `service_role` has by default)
only skips row-level policies, it doesn't grant the underlying SQL
privileges a role needs to touch a table at all, and this repo's
migrations never explicitly granted them (Supabase's hosted platform
provisions that automatically when a project is created; the CLI's local
instance, built purely by replaying committed migrations, does not).
Added `0008_grant_service_role.sql`, scoped to exactly the two tables and
operations the cron route actually performs — not a blanket grant — since
whether the real hosted project already has these grants is unverified
and the safer default is not to assume it.
**A third, non-bug finding during verification:** `NEXT_PUBLIC_*`
environment variables are statically inlined at *build* time, everywhere
— including server-only route handler code, not just client bundles.
Overriding them at `next start` time (even correctly, via `--env-file`
after ruling out shell-escaping as a cause) had no effect, because the
value was already baked into the compiled output from the earlier build.
Cost real time to isolate — worth remembering the next time a runtime env
override for a `NEXT_PUBLIC_*` variable appears to silently not apply: it
never will, the fix is always to rebuild with the value already set.
**Verified end-to-end against a local Supabase stack, not just unit-level
logic:** seeded a real `notification_prefs`/`push_subscriptions` row pair,
confirmed the `CRON_SECRET` check rejects no-auth and wrong-secret
requests (both correctly redirected to the route's own 401 only after the
proxy.ts fix — before that, both were silently swallowed by the Clerk
redirect instead), confirmed a correctly-authenticated request processes
the seeded user and advances `daily_prompt_last_sent_date`, confirmed a
second immediate invocation is a no-op (`usersProcessed: 0` — the
idempotency guard working), and confirmed the 404/410 stale-subscription
cleanup path fires and deletes the row using a genuine, real EC keypair
(generated via Node's own `crypto.generateKeyPairSync`) sent over an
actual network request to Google's real FCM endpoint — not a mock, a real
push service correctly rejecting a fake registration ID. Added a
`console.error` for the non-404/410 branch after noticing send failures
were otherwise completely invisible even in logs — cheap interim
visibility ahead of NK-06 (production error monitoring, not built yet).

### 2026-08-25 — NK-16: append to today's entry, not general editing

**Decision:** Scoped NK-16 to **append to today's own entry only**, not
general entry editing. New text is added to the end of today's existing
entry, old text stays read-only, and appending to any entry from a prior
day is rejected — both in the UI (no affordance shown) and server-side
(`PATCH /api/entries/[id]` 403s if the entry's `created_at` isn't today,
in the device's local calendar day, same comparison style as the existing
"one year ago today" feature). This is entries' first update path ever
(previously insert/delete only — a deliberate fact recorded in
`ARCHITECTURE.md` §10.6.2 and `ROADMAP.md` NK-16, precisely because
§10.6.2 already flagged what would break if it changed). Full design:
`docs/plans/2026-08-24-append-to-todays-entry-design.md`; 13-task plan:
`docs/plans/2026-08-24-append-to-todays-entry-plan.md`.

**Why:** The user's actual complaint was narrow — multiple thoughts
through the day land as separate entries, and they want them together.
Full entry editing (rewrite any past entry, any time) was never the ask,
and it's a much bigger surface — undo, edit history, arbitrary-content-
change interaction with everything downstream that assumes entries only
ever get inserted or deleted. Append-only, today-only matches the stated
need with the smaller surface.

**The playback narrative cache staleness warning in §10.6.2 came true, and
is now fixed.** `buildNarrativeCacheKey` (`src/lib/playback/narrativeCache.ts`)
keyed on bare sorted entry IDs, on the explicit assumption that an entry's
ID set fully describes its content. That assumption broke the moment an
entry could change content without a new ID. Fixed by adding an
`entries.updated_at` column (`0009_entries_updated_at.sql`) and hashing
`(id, updated_at)` pairs instead of bare IDs — an appended-to entry now
gets a fresh cache key rather than silently serving a stale cached
narrative. TDD'd against `narrativeCache.test.ts` (written failing first,
confirmed it failed for the right reason, then implemented).

**Manifestation-signal detection now deletes before it inserts, on
purpose.** `/api/manifestation-signals` re-runs full-entry signal
detection after every save, including an append — re-running against the
grown entry (not just the newly appended text) was the user's own explicit
choice, since a signal might only become detectable once the full day's
context is present. Without a delete-first step, re-running on the same
`entry_id` would accumulate duplicate signal rows on every append,
silently inflating a signal's count each time — breaking the invariant
that "the signal count means something." The delete is placed *after* the
early-return for a zero-result detection pass, so a run that finds nothing
doesn't wipe out real prior detections; it only clears the slate when
there's something to replace it with.

**Mood/tags on append: mood replaces, tags merge** — a mood score is a
snapshot of one moment (there's only one `mood_score` column; the user's
own choice from `AskUserQuestion`), so the day's most recent mood
overwrites the prior value. Tags are additive across a day's thoughts
(`[...new Set([...oldTags, ...newTags])]`), since a later addition
shouldn't silently drop tags applied earlier that day.

**A second, real infrastructure bug found during verification, same class
as NK-10's:** the first attempt to verify the `PATCH` route against the
local Supabase CLI stack using the service-role key hit a `permission
denied for table entries` error. Root cause, confirmed by hand-constructing
a real signed local JWT (HS256, the stack's known `JWT_SECRET`, `role:
"authenticated"`) and running an actually RLS-scoped query rather than
guessing: the local Postgres instance's `authenticated` role — the role
every real per-request Clerk-JWT-forwarded query runs as — had never been
granted baseline SQL privileges (`select/insert/update/delete`) on *any*
table in the schema. RLS policies only govern which rows a role can see;
they say nothing about whether the role can touch the table at all. Same
gap class as NK-10's `service_role` fix (`0008_grant_service_role.sql`),
one layer broader — this one would have silently blocked any future local
verification of authenticated (non-service-role) writes, not just this
feature's. Fixed with `0010_grant_authenticated.sql`, granting the same
operations across every application table, not scoped narrowly to just
`entries` — since the gap itself wasn't narrow.

**Verified against a real local Supabase stack, not just unit tests:**
`supabase db reset` (not `start`, which kept restoring a stale snapshot
missing the new migrations — a recurring finding this session) to force a
full migration replay; direct `psql` checks of `entries.updated_at` and
the new grants rather than trusting CLI output; the hand-signed JWT
technique above to exercise genuinely RLS-scoped `PATCH` requests; and a
full live-browser pass (`NEXT_PUBLIC_PREVIEW_MODE=1`, `next build` +
`next start`) confirming the append flow end-to-end — existing text
read-only, new text appended with a blank-line separator, mood/tag
pre-fill via React's documented "adjust state during render" pattern (no
`useEffect`, since there's no async step here unlike NK-01's draft-restore
case), Home's CTA switching to "Continue today's entry," and the
entry-detail page's "Add to this entry" link appearing only on today's own
entry. Full sweep (typecheck/lint/test/build) all exit 0.

### 2026-08-25 — AI privacy controls: an off switch, gated client-side

**Decision:** Built a real, working "turn AI off" switch
(`src/lib/hooks/useAiEnabled.ts`, boolean stored in Clerk `unsafeMetadata`
— same mechanism as `tone`) rather than three independent per-feature
toggles. Enforced at each of the three plaintext-to-OpenAI call sites
(`useSignalDetector.ts`, the playback-narrative trigger in
`playback/story/page.tsx`, the voice-mode render in `write/page.tsx`) by
checking the switch and returning *before* the `fetch` — not in the
`/api/ai/*` route handlers. Full design:
`docs/plans/2026-08-25-ai-privacy-controls-design.md`; 11-task plan:
`docs/plans/2026-08-25-ai-privacy-controls-plan.md`.

**Why:** Users raised a real, specific concern: "the app uses AI, so how
secure is my journal really — if AI knows my deepest secrets, someone else
could too." Reading the actual code (not the docs) turned up three real
gaps behind that fear: no off switch existed at all; manifestation-signal
detection ran automatically after every save, consented to only via a
toggle the user set on a *goal*, not on "send my entries to OpenAI"; and
the privacy copy said AI content "is not retained *by us*" — true, and
silent on OpenAI's own retention, which is a materially different claim.

**Client-side enforcement, not server-side, and this is the load-bearing
choice:** a check inside `/api/ai/playback` or `/api/ai/transcribe` can't
undo an exposure that's already happened — plaintext reaches the route
handler over the wire before any server code runs, so by the time a
server-side gate could reject the request, the thing the switch exists to
prevent has already occurred. Only a check *before* the `fetch` call
actually stops it. This also means the guarantee is inspectable: a
skeptical user (or their browser's network tab) can verify the claim
directly, rather than trusting a server-side promise.

**One master switch, not three:** the value of this feature is the
sentence a user can say afterward — "nothing I write leaves my device."
Three independent toggles (playback / voice / signal-detection) would mean
no clean sentence is ever available, since a user could always have
partially opted in without realizing it. The `auto_detect` toggle on
individual manifestations still exists underneath the master switch (for
turning detection off per-goal even when AI is otherwise on), but its
label was rewritten to say plainly what it sends, rather than the vaguer
"automatically link journal entries" it had before.

**On by default for existing users, not silently flipped off:** turning
AI off after the fact would silently break playback and voice
transcription for everyone already using them. This ships as a new choice
being offered — disclosed prominently in the new Settings → Privacy &
Security section and in the updated privacy copy — not a removal applied
without asking.

**OpenAI's retention policy was verified live against their current docs
in this session, not recalled from training data** — a real, checkable
claim now heading into user-facing privacy copy deserved the same
"check the source" standard this session already applies to platform
constraints (e.g. NK-10's Vercel Cron research). Fetched
`developers.openai.com/api/docs/guides/your-data` directly: API traffic
isn't used to train OpenAI's models by default (true since March 2023,
already stated correctly in the app), but *is* retained by OpenAI for up
to 30 days for abuse monitoring, unless longer retention is legally
required — a fact that appeared nowhere in the app before this. Added to
both `content/privacy.md` and `content/encryption.md`. Zero Data
Retention (an OpenAI offering that would close this gap structurally,
covering all three plaintext-sending endpoints) was identified as a real
follow-up but requires OpenAI sales approval — an account-level step
outside this codebase, explicitly out of scope for this round.

**A genuine overclaim was found and fixed while writing the disclosure,
not just the underclaim that motivated it:** `content/privacy.md` listed
"daily prompts" among the AI features that send entry text to OpenAI.
They don't — `/api/ai/prompt` calls `generateDailyPrompt(tone, [])`, an
empty summaries list, cached and shared across every user on the same
tone. Fixing this actually shrank the disclosed surface from four AI
features to three, the opposite direction from every other change in this
entry.

**A design-doc correction made during planning, not silently absorbed:**
the approved design also named a "voice-mode badge" in `write/page.tsx`
as a third badge-fix target. It doesn't exist — `VoiceRecorder.tsx` shows
no "End-to-End Encrypted" claim at all during recording, and both badges
that do exist in `write/page.tsx` are generic to every save (accurate
either way, since the final entry really is encrypted regardless of how
the text originated) and were correctly left untouched. The design doc
was corrected in place rather than quietly implementing something
different from what it said — only two badge call sites actually changed
(`playback/story/page.tsx`, both occurrences), where "End-to-End
Encrypted" sat directly under content that only exists because plaintext
left the device.

**Also fixed in passing, found while designing this:** `PublicPageChrome`
hard-coded a "Sign in" button on the app's own privacy/encryption/about
pages — even for a signed-in user who reached one of these pages via the
new Settings links, a dead end with no path back to the app. Made the
header signed-in-aware (`useUser().isSignedIn` → "Back to journal" vs.
"Sign in").

**Live verification had a real, structural limit, stated honestly rather
than faked:** `PREVIEW_MODE` deliberately doesn't fake a Clerk session
(see this file's 2026-08-22 entry — "write mutations... correctly fail
with no session in preview mode"), so `setAiEnabled`'s `user.update()`
call can never succeed in this sandbox's preview mode, and `aiEnabled` can
never actually be flipped to `false` live here — the same limitation this
app already accepts for `tone`. What *was* verified live
(`NEXT_PUBLIC_PREVIEW_MODE=1`, `next build` + `next start`): the Settings
section renders with the correct default and copy; the playback-story
badge fix renders the new copy on a real generated narrative; the
manifestation auto-detect label; the corrected privacy/encryption/about
copy; and `PublicPageHeader` correctly rendering its "Sign in" fallback
branch (the honest expected result with no real session) without
crashing. The three gate placements themselves (`if (!aiEnabled) return;`
before each `fetch`) were verified by direct code reading rather than a
live click-through, since exercising the `false` branch live would
require a real Clerk account — which this project's own preview-mode
design, and Claude's operating rules, both rule out creating. Full sweep
(typecheck/lint/test/build) all exit 0.

### 2026-08-25 — Brand logo swap #2, and PWA icons finally brought in line

**Decision:** Replaced every derived logo asset with the new glyph
(sourced from Stitch `projects/13778589545983828422/screens/a97b8726b0ee464eae9a2d8d6b180a6a`
— an enlarged, ultra-bold "reduce whitespace" pass on the same project's
logo, requested directly by the user with a reference image): `logo-mark.png`
(transparent, `--color-primary` #4a654e, for inline use next to text) and
`logo-full.png` (512×512 rounded ivory card, `--color-primary-container`
#8ba88e glyph, source for `icon.png`/`apple-icon.png`). Also regenerated
the four PWA install icons (`public/icons/icon-{192,512}.png` and their
`-maskable` variants) referenced by `manifest.json`, which the previous
2026-08-24 logo pass never touched.
**Why:** User asked to update the logo "everywhere." The PWA icons were a
real, separate gap — `git log` on `public/icons/*` showed them dated
2026-08-22, predating the Stitch brand logo entirely; they were still the
original generic "sun over hills" placeholder (`public/icons/source-any.svg`),
never brought in line when the favicon/inline mark were swapped last time.
Left unfixed, "The Nook" would show the correct new glyph in the browser
tab and on the sign-in page, but the old placeholder scene on an Android/iOS
home-screen install — a real, user-visible inconsistency, not a
hypothetical one.
**How the raster was processed:** Stitch's `get_screen` still returns a
flattened JPEG with the background baked in as solid ivory (#faf9f6), not
real alpha — same limitation as the first logo pass. Recovered
transparency in Python/Pillow via distance-based chroma-keying against
the sampled ivory background (not literal equality, to keep clean
anti-aliased edges), then cropped to content and **padded out to a square
canvas** before saving — every call site (`PublicPageChrome`, sign-in,
sign-up) sets equal `width`/`height` on the `<img>`, so a non-square
source would have silently stretched. Caught by comparing the new
`logo-mark.png`'s output size against the old file's dimensions before
finalizing, not assumed.
**Maskable-icon safe zone respected, not guessed:** the two `-maskable`
manifest entries use much larger padding (glyph at ~55% of canvas) than
the `any`-purpose icons (~78%), per the W3C maskable-icon convention that
an OS may crop content outside the center safe zone when applying its own
mask shape (circle, squircle, rounded square) — verified by checking
`manifest.json`'s `purpose` field for each entry before choosing padding,
not applied uniformly.
**Scope decision, stated rather than silently expanded further:**
`public/icons/source-any.svg` and `source-maskable.svg` were left
untouched and are now stale — hand-authored placeholder SVGs, unreferenced
by any code path (only the PNGs `manifest.json` points to matter at
runtime), predating any icon-generation script. Recreating them as real vector
paths from a flattened raster wasn't attempted; not worth fabricating.
**Verified live, not just by reading the files:** `NEXT_PUBLIC_PREVIEW_MODE=1`
dev server, `/about` (20px header mark) and `/sign-in` (36px hero mark)
screenshotted at 4x zoom — clean edges, correct color, no chroma-key
fringing/halo — and confirmed via `document.querySelectorAll('link[rel*="icon"]')`
that the page's actual `<link>` tags resolve to the new `icon.png`/`apple-icon.png`
files, not just that the files on disk look right. Full sweep
(typecheck/lint/test) all exit 0 — no source code changed, image assets only.

### 2026-08-25 — NK-20: self-host and codepoint-subset Material Symbols

**Decision:** Replaced `layout.tsx`'s Google Fonts `<link rel="stylesheet">`
for Material Symbols with a self-hosted `next/font/local` font, subsetted
to exactly the ~77 icon codepoints this app uses (`src/app/fonts/material-symbols-outlined-subset.woff2`,
3.96MB → 66KB). `MaterialIcon.tsx` now renders a looked-up PUA character
(`src/lib/materialSymbolsCodepoints.ts`) instead of the icon's literal
name as ligature text — the subsetted font has no GSUB ligature tables
left, only direct codepoint-to-glyph mappings.
**Why:** User shared real Vercel Speed Insights production data: mobile
Real Experience Score 56, FCP and LCP both 7.03s (red), while TTFB was
0.34s (green) — proof the ~6.7s gap was entirely client-side, not a slow
server. `layout.tsx`'s Material Symbols `<link>` was the one resource on
the critical rendering path that didn't go through `next/font` (the other
four fonts — Geist, Geist Mono, Newsreader, Hanken Grotesk — already did):
a synchronous fetch to a cold third-party origin (`fonts.googleapis.com`,
then `fonts.gstatic.com` for the actual font file), on literally every
page, for a font covering the *entire* Material Symbols icon set when the
app uses about 77 of its several thousand icons.
**Ligature-based subsetting was tried first and mostly failed — worth
recording so it isn't retried blind.** `pyftsubset --text-file=<icon
names> --layout-features='*'` (with `uharfbuzz` installed for real
shaping-based closure) only shrank the font from 6597 to 5851 glyphs —
barely 11%. Root cause, confirmed by inspecting the font directly: the
GSUB ligature substitution Material Symbols uses (`rlig`/`rclt`, not the
more common `liga`) is a large, shared, contextual-substitution graph —
closing over "every glyph reachable from this input text" pulls in most
of the font regardless of how few distinct icon names are actually
referenced, because so many icon names share substring prefixes that
fork deep into that shared graph. **Codepoint-based subsetting doesn't
have this problem.** Material Symbols also assigns every icon a stable
Private-Use-Area codepoint (Google's own `.codepoints` file, fetched
directly from `google/material-design-icons` on GitHub and cross-checked
against all 77 names used — zero misses); subsetting by exact
`--unicodes=` is precise, no GSUB closure involved, and produced the
actual 66KB result. The cost of this approach, stated rather than hidden:
MaterialIcon no longer renders icon names as literal text, so a
newly-introduced icon name needs its codepoint added to
`materialSymbolsCodepoints.ts` and the font re-subsetted — documented
directly in that file's header, with a dev-time `console.warn` in
`MaterialIcon.tsx` if a name has no entry, so a missed one fails loudly
in development rather than silently rendering nothing in production.
**A real, separate, smaller lever was found and deliberately not pulled
this round:** `next/next/no-img-element` flags 7 files still using raw
`<img>` instead of `next/image` (pre-existing lint warnings, not
introduced here). Left alone because the images involved are all small
(10–34KB — the hero photos and the brand logo) and TTFB/CLS were already
in the green on the real production data, so this wasn't a plausible
contributor to a 6.7-second gap the way a multi-megabyte render-blocking
font request clearly was. Recorded as a genuine, smaller follow-up in
`docs/ROADMAP.md` NK-20 rather than silently bundled into this pass.
**Verified concretely, not assumed:** confirmed zero `fonts.googleapis.com`
references anywhere in the built HTML/JS output (`grep` across
`.next/server` and `.next/static`); confirmed the new woff2 file appears
in `.next/static/media` at the expected ~66KB; live-browser pass across
Home, Journal, Settings, Manifestations, Playback (light and dark
screens), and About confirmed every icon renders correctly, with zero
`console.warn` "no entry" hits anywhere. One real detour during
verification, unrelated to this change: `NEXT_PUBLIC_*` env vars are
inlined at *build* time (a fact this project has hit and documented
before — see the 2026-08-22 preview-mode entry) — an initial verification
attempt reused a production build made without `NEXT_PUBLIC_PREVIEW_MODE=1`
set, which surfaced as an unrelated-looking `/api/keys` 500 and a Clerk
`auth()` error; resolved by rebuilding with the flag set, not by touching
any auth code. Full sweep (typecheck/lint/test/build) all exit 0.

### 2026-08-25 — Auto-lock on backgrounding, after a 60-second grace period

**Decision:** Built `src/lib/hooks/useAutoLock.ts`, mounted once inside
`UnlockGate.tsx`: listens for `document.visibilitychange`, and if the
app stays hidden for 60 continuous seconds, calls the session store's
`lock()` action (which existed already but had never been invoked
anywhere in the app). A grace period, not an instant lock, and not a
configurable Settings value — one fixed default. Also added a manual
"Lock now" row to Settings, wiring up `lock()` a second way.
**Why:** User noticed that minimizing the installed PWA and reopening it
never re-prompted for the passphrase, while force-quitting did — and
asked for this to be designed properly rather than patched. Root cause
wasn't a bug: `useSessionStore` is deliberately in-memory-only (by
design, so a reload/kill wipes it), but nothing had ever been built to
proactively re-lock on backgrounding, and iOS/Android typically
*suspend* a backgrounded PWA rather than killing it — so the in-memory
DEK could survive indefinitely with the app just sitting in the app
switcher. `content/encryption.md` already states the app doesn't protect
against "someone who has your unlocked device in hand," but there's a
real, meaningfully different gap between that and the journal staying
silently unlocked for hours. A grace period (not instant) was chosen
because the alternative — locking the instant the app leaves the
foreground — would mean re-entering the passphrase every time a
notification or a text reply pulls focus away mid-entry, which is
annoying enough that a user would reasonably come to resent the
feature meant to protect them. 60 seconds specifically, fixed rather
than a new Settings toggle: one sensible default, no new surface area to
build, explain, or maintain.
**No race with the composer's existing draft-autosave:**
`useComposerDraft.ts` already flushes the in-progress draft to
IndexedDB (DEK-encrypted) within ~200ms of the same
`document.visibilitychange` event going hidden — both listeners fire off
the identical event, and the flush completes 59+ seconds before this
hook's timer could ever fire. Nothing needed to change there.
**A real bug was suspected during verification, investigated properly,
and turned out not to exist:** dispatching a synthetic `hidden` then
`visible` event in the browser with a short simulated grace period
appeared to show the lock firing anyway despite the "visible" dispatch —
looked exactly like a broken cancellation path. Rather than assume that
and patch around it, added per-call timestamped logging and re-ran the
test: the real wall-clock delay between two separate tool-driven
`javascript_exec` calls in this sandbox turned out to exceed the
artificially-shortened grace period being tested against (over 8 real
seconds elapsed for what was requested as a 1-second wait, due to tool
round-trip overhead) — the timer had genuinely already fired for real
before the cancel dispatch happened. Confirmed the actual logic is
correct by dispatching `hidden` and `visible` back-to-back in a single
tool call (eliminating the round-trip gap): the same `timeoutId` was
correctly seen and cleared, and the lock did not fire even 48 seconds
later. Worth remembering: this sandbox's own tool-call round-trip
latency can exceed several seconds, which matters when hand-simulating
a short timer window — use back-to-back same-call dispatches, or a
window generously longer than the round-trip overhead, not a bare
assumption that two sequential tool calls happen near-instantly.
**A second, unrelated environment quirk hit during the same verification
pass:** a `next start` process from several rebuilds earlier in this
session had become unkillable from a fresh Bash invocation
(`kill`/`pkill`, even with the sandbox disabled, returned "operation not
permitted" on a same-user process) — not a Vercel/Browser-pane-managed
process (confirmed via `preview_list`), just a plain orphaned background
job the sandbox no longer had signal permission for. The tab kept
serving stale build output against it (a `ChunkLoadError` referencing a
chunk hash from an old build), which looked exactly like a real app
regression until traced back. Fixed by starting the fresh server on a
different port (3111) instead of fighting for the stale one — simpler
and just as valid for local verification.
**Live-verified:** the timer firing (correctly locks) and the
cancellation path (correctly doesn't, even well past the real window),
both via direct timestamped evidence, not assumption. Also verified live:
composer text survives a background/foreground cycle well under 60s with
no interruption or prompt; the "Lock now" Settings row renders correctly
and its click handler runs without error. **Not verified live, and
can't be, structurally:** the actual passphrase-unlock screen rendering
after a real lock — `PREVIEW_MODE` deliberately never fakes a Clerk
session (2026-08-22 entry) and its `UnlockGate` branch auto-re-unlocks
via `getPreviewDek()` any time `isUnlocked` goes false, so a locked state
can't be visually observed in this sandbox's preview mode — same
structural limitation the AI-privacy-controls work hit verifying its own
Clerk-metadata toggle. `UnlockGate`'s `isUnlocked → show unlock screen`
branch itself is pre-existing and unchanged by this feature, already
exercised by every real sign-in. Full sweep (typecheck/lint/test/build)
all exit 0.

### 2026-08-25 — NK-21: Home's LCP was a late DOM insertion, not a bundle problem

**Decision:** Added `RecentThoughtSkeleton` to `src/app/(app)/page.tsx` —
three placeholder blocks, sized to match a real "Recent Thoughts" entry
exactly (same padding, same two-line text height via a fixed `h-6`
matching `--text-body-md--line-height` rather than the newer `1lh` CSS
unit, for reliable iOS Safari support), shown while `useEntries()` is
loading instead of rendering nothing.
**Why:** Follow-up to NK-20, against fresh production Speed Insights
data pulled after that fix shipped: RES climbed 56→62, FCP dropped
7.03s→3.89s, but LCP was still "Poor" at 5.49s P75. This time the
dashboard's route-level breakdown was available (it hadn't been on the
first pull) — `/` measured 5.7s, `/sign-in` 3.89s, `/about` and `/write`
already "Great." That ruled out a shared-bundle-weight explanation
immediately: `/` and `/write` are both statically prerendered and, once
their generated `<script>` tags were directly diffed (19 vs 19 files,
only one differing), carry almost identical JS payload — so a font-style
fix wouldn't apply here the way it did for NK-20.
**Root cause, found by reading the actual render logic, not guessing:**
`recentEntries = (entries ?? []).slice(0, 3)` — while `entries` is still
`undefined` (loading), this is an empty array, and the "Recent Thoughts"
section renders with zero entries under its heading. Once
`/api/entries` resolves, three brand-new text blocks enter the DOM at
once. This matters specifically because of how LCP candidacy works: a
text-only mutation inside an element that's already painted does not
retrigger LCP, but a new element entering the render tree does — so
those three late-arriving blocks were the most likely actual LCP
element, not anything about the page's bundle or fonts. This effect is
disproportionately visible on `/` specifically because it's the app's
actual landing page (PWA launch, bookmark, cold app-open) and therefore
far more likely than `/write` or `/journal` — both usually reached via
warm in-app client-side navigation with React Query's cache already
populated — to hit a genuinely empty cache and pay the full network
round-trip cost before anything in that section can paint.
**Verified live, working around the same tool-round-trip-latency lesson
learned during the auto-lock work:** preview mode's fixture entries
resolve via real (if fast) WebCrypto encryption, fast enough that a
`javascript_exec` query for skeleton elements right after navigation
found none — the fetch had already resolved by the time the tool's
round trip completed. Rather than accept that as "can't verify,"
temporarily added a 4-second artificial delay to the preview-mode branch
of `useEntries.ts`'s `queryFn` (reverted immediately after, confirmed via
`git diff` showing no residual change), which made the loading window
long enough to actually observe: screenshotted the skeleton rendering
correctly on first paint, then screenshotted again after the delay
resolved, confirming the real content swapped in at the same position
with no visible layout jump — the whole point of sizing the skeleton to
match. Full sweep (typecheck/lint/test/build) all exit 0.

### 2026-08-25 — NK-22: a plain `<link rel="preconnect">` isn't enough — needed `ReactDOM.preconnect()`

**Decision:** Added `src/components/ClerkPreconnect.tsx` — a tiny Client
Component that calls `ReactDOM.preconnect("https://clerk.creator-ai.in",
{ crossOrigin: "anonymous" })` during render — mounted once in
`layout.tsx`. Not a JSX `<link rel="preconnect">` element, despite that
being the obvious first approach.
**Why:** Third follow-up against fresh production Speed Insights data:
RES 62, FCP itself still "Poor" at 3.89s P75. Route breakdown named
`/sign-in` as the worst FCP route with a real sample count. Curling
production directly showed why: Clerk's JS SDK loads from
`clerk.creator-ai.in` (its own dedicated Frontend API subdomain) via an
async `<script>` Clerk injects itself, with no resource hint ahead of it
anywhere in the document — a genuine third-party origin paying full
DNS+TLS setup cost before the browser can even issue the request.
**The plain `<link>` approach was tried first and silently failed —
worth recording precisely, not just "use the other API."** Adding
`<link rel="preconnect" href="..." crossOrigin="anonymous" />` — first
wrapped in an explicit `<head>`, then as a bare element per React 19's
documented auto-hoisting — rendered correctly in both cases, but in the
actual generated HTML output landed at position 32 in `<head>`, *after*
Clerk's own script tag at position 24. A hint the browser only sees
after it's already started the connection it was meant to preempt does
nothing. This was only caught by writing a script to walk the real build
output and print `<head>` children in document order — a screenshot or
a "does the tag exist" check would have missed it entirely, since the
tag genuinely was present and correctly formed, just uselessly placed.
Root-caused via Next's own bundled docs
(`generate-metadata.md`'s "Resource hints" section, not recalled from
memory): the dedicated `ReactDOM.preconnect`/`preload`/`prefetchDNS`
APIs are explicitly what `next/font` and `next/script` use internally
for correct head-priority scheduling — a plain declarative `<link>`
doesn't receive the same treatment, apparently deprioritized as a
"hint" relative to scripts/stylesheets regardless of source position in
the JSX tree. Switching to the dedicated API moved the hint to position
1 — before every other script, including Clerk's own — confirmed the
same way, by re-inspecting the real build output, not by trusting that
switching APIs "should" fix it.
**Verified:** typecheck/lint/test/build all exit 0; live no-regression
pass on Home and About confirmed no console errors introduced by the new
component. Not separately investigated: `/sso-callback`'s 8.44s FCP
sample — a single data point, too little to read into on its own, and
this fix (same root layout, same preconnect) already benefits it
identically to `/sign-in` regardless.

<!-- no-log: routine update to ROADMAP.md's launch-ready checklist annotation, reflecting real-device iOS install evidence from this session's earlier conversation — no decision or anti-pattern worth recording -->

### 2026-08-25 — NK-06: Sentry error monitoring, and what "safe defaults" actually required

**Decision:** Integrated `@sentry/nextjs` (user's explicit vendor choice,
real DSN provided directly in conversation) app-wide, active only in
real production. The entire design effort went into the data-collection
configuration, not the wiring: every category Sentry could send by
default is explicitly disabled in `src/lib/monitoring/sentryOptions.ts`,
console breadcrumbs are dropped outright, and Session Replay is never
installed. Design: `docs/plans/2026-08-25-sentry-error-monitoring-design.md`;
plan: `docs/plans/2026-08-25-sentry-error-monitoring-plan.md`.
**Why:** NK-06 was the last unchecked launch-readiness blocker — a crash
in unlock or decrypt has been completely silent in production this
entire time. The roadmap item itself already named the constraint:
"must exclude entry content from payloads." For an app whose entire
credibility rests on plaintext never leaving the device, a careless
error-monitoring integration is exactly the kind of thing that quietly
undermines the product's own claim while looking like unrelated
infrastructure work.

**The single most important finding of this feature: `sendDefaultPii:
false` — the approved design's original safeguard — does not prevent
the actual dangerous default.** Verified directly against the installed
`@sentry/core@10.71.0` type definitions, not documentation summaries
(which had already led the design astray once — see below).
`sendDefaultPii` is deprecated in this SDK version in favor of a newer
`dataCollection` option, and several of its categories default to
**on** regardless of `sendDefaultPii`'s value. Most critically,
`dataCollection.stackFrameVariables` defaults to `true`: local variable
*values* in a crashing function's stack frame, sent as-is. This app
holds decrypted journal text in local variables in multiple places
(`write/page.tsx`'s `handleSave()` — the `combined` variable literally
holds the plaintext about to be saved) — a crash while one was in scope
would have sent the actual journal entry to Sentry, under a
configuration the approved design believed was safe. Caught mid-
implementation, before any code shipped against the wrong assumption,
specifically because the plan called for checking option names against
the real installed package rather than trusting the design doc as
final. The design doc was revised in place once this was found, with
the correction stated plainly rather than absorbed silently.

**A second inaccuracy, found the same way, corrected the same way:**
the design also claimed `data-sentry-mask` (added to the passphrase
input, recovery-phrase display, and composer fields) would keep DOM
click/keypress breadcrumbs from including their content. Checked
against the installed package: `data-sentry-mask` exists only in
`@sentry/replay`'s source, not `@sentry/browser-utils` (which builds
the actual DOM breadcrumbs via `htmlTreeAsString`) — since this design
never installs Session Replay, the attribute currently does nothing.
Separately, `htmlTreeAsString` itself was checked and confirmed to
build only a CSS-selector-style description (tag/class/id), never
`.textContent`/`.value` — so the risk this attribute was meant to
address was smaller than described in the first place. Kept in the
code anyway, honestly labeled as forward-compatible insurance (correct
if Replay is ever added later without a full re-audit) rather than as
active protection today.

**Real, unglamorous errors surfaced by actually running the tooling,
not just reading about it:** `next.config.ts`'s `withSentryConfig` call
originally included `disableLogger: true` — the build itself warned
this option is deprecated *and* "not supported with Turbopack" (this
app's build tool), so it was dead configuration, not a real setting;
removed. `sentryOptions.ts`'s `beforeSend` destructuring-to-discard
pattern (`const { data: _data, ... }`) tripped this repo's
`@typescript-eslint/no-unused-vars` rule, which has no underscore-prefix
exemption configured — fixed by deleting keys from a shallow copy
instead of destructuring past them.

**Verification had a real, honestly-reported limit — investigated
thoroughly, not glossed over.** What *was* directly confirmed: the
data-collection policy's own logic (9 unit tests, TDD'd); the correct
DSN and `enabled: true` baked into the real build output; Sentry's own
`debug: true` logging showing `Integration installed` for every expected
integration and `Captured error event` for deliberately-triggered test
errors, with `__sentry_captured__: true` on the resulting console error;
and — via a raw `fetch()` to the real DSN's ingest URL — that genuine
network egress from this sandboxed environment to Sentry's actual
servers works (a real `400` response for a deliberately malformed test
body, not a connectivity failure). What was **not** directly observed:
the SDK's own internal transport request actually leaving the browser.
Monkey-patching `fetch`/`sendBeacon`/`XMLHttpRequest` to intercept it
caught nothing — most likely because Sentry's transport binds its
network primitives at `Sentry.init()` time, before a `javascript_exec`
call issued after page load can patch them, not evidence the request
never happened. `read_network_requests` (the Browser pane's own
protocol-level tap, unaffected by that timing issue) also showed zero
matching requests across multiple waits up to 20+ seconds, which is the
more trustworthy signal but still not conclusive either way. Reverted
the temporary `debug: true` and forced-`enabled: true` changes cleanly
(confirmed via `git diff` showing no residual change) rather than ship
either as real config. This is a genuine, narrow gap in what this
session's tools could confirm — the same class of limitation as NK-09's
push-permission prompt and the AI-privacy work's Clerk-metadata write —
not a claim that the feature doesn't work. A first real check of the
Sentry dashboard after this ships is the honest remaining step, and
belongs to the account owner.

**Also deliberately deferred, stated rather than silently skipped:**
source-map upload (readable stack traces in the Sentry dashboard) needs
an `authToken` plus org/project slugs the user would need to generate —
`withSentryConfig` is called with none of them, which makes it skip
upload gracefully rather than fail the build. Real follow-up, not
required for error capture itself to function.

Full sweep (typecheck/lint/test/build) all exit 0.

### 2026-08-25 — NK-12: entry length cap enforced at the AI routes, not the entries API

**Decision:** 10,000 characters, hard `maxLength` stop, matching
`ManifestationForm`'s existing capped-input UX rather than inventing a
new pattern. The composer's `maxLength` is dynamic in append mode
(`10,000 − existing text length`) so appending can't creep a single
entry past the cap one thought at a time. Server-side, the cap is
enforced by truncation (not rejection) at `/api/ai/playback` and
`/api/ai/detect-signals` specifically — not `/api/entries`.
**Why:** The entries storage routes never see plaintext at all — this
app encrypts client-side, so the server only ever holds ciphertext for
saved entries — meaning a character-count cap literally cannot be
enforced meaningfully there. The two AI routes are different: they
receive real plaintext, transiently, specifically to make one OpenAI
call (§6.4/§6.5). That's exactly where the roadmap's actual concern —
"cost per call is unbounded" — materializes, so that's where the
server-side safety net belongs. Truncation rather than a 400 rejection:
the client-side cap already prevents this path from being hit in normal
use, so this exists purely to bound cost against a bypassed client or a
pre-cap entry, not to punish or interrupt a real save.
**Verified live:** in append mode, confirmed the textarea's actual
`maxLength` DOM property equals `10,000 − existingText.length` for a
real fixture entry (not just read from the diff); confirmed the "X /
10,000" counter appears only past the 80% combined-length threshold and
is absent below it.

### 2026-08-25 — NK-13: aggregate spend ceiling, and a third instance of the same grant-gap class

**Decision:** $1/day, configurable via `AI_DAILY_SPEND_CEILING_USD`,
computed against real current OpenAI pricing (gpt-4o-mini $0.15/$0.60
per 1M input/output tokens, whisper-1 $0.006/minute — fetched from
OpenAI's published pricing page, not recalled). Covers all four
`/api/ai/*` routes, including transcribe. Degradation is per-route, not
uniform: `prompt` silently serves a static fallback with no error
surfaced at all (a daily prompt is low-stakes enough that a degraded-
mode message would be more disruptive than the degradation itself);
`detect-signals` silently returns no signals, matching its already-
established best-effort/fire-and-forget posture
(`useSignalDetector.ts`); `playback` and `transcribe` — both explicit,
deliberate user actions with no silent fallback available — get a
distinct, accurate message ("temporarily paused... check back
tomorrow" / "try typing instead") rather than either a generic error or
silence.
**Why:** Whisper bills by audio duration, not tokens, so `ai_usage_log`'s
existing token columns couldn't price it — the honest choice was
between a real migration or an aggregate ceiling that quietly excludes
one of the four routes it claims to bound. Chose correctness: added
`duration_seconds` (`0011_ai_usage_log_duration.sql`), captured it from
`transcribeAudio`'s existing (already-present, previously unused)
duration-variant usage response, and priced it in
`computeCallCostUsd` (`src/lib/ai/cost.ts`, TDD'd) alongside the
token-based routes.
**A third instance of the exact grant-gap class found in NK-10 and
NK-16, this time on `ai_usage_log`:** the aggregate check is a genuine
cross-user read, which the normal per-request client structurally
cannot do (RLS scopes it to the caller's own rows) — needing the
service-role client, previously used in exactly one place
(`daily-reminder` cron) with a doc comment that said "never call it
from a route reachable by a browser/user request." Updated that
comment to describe both sanctioned uses and *why* this one is safe
despite being called from a user-reachable route (`playback`,
`transcribe`, etc.): the aggregate dollar figure it computes is used
only as an internal boolean gate, never returned to the client in raw
or per-user form — no path for one user's individual usage to leak to
another. Verification against the real local instance then hit exactly
the same wall NK-10 and NK-16 both hit: `service_role` had zero grants
on `ai_usage_log` specifically (0008's grant migration was deliberately
scoped to only the two tables the cron route touches, so this was never
an oversight in 0008 — it's a genuinely new need). Fixed with
`0012_grant_service_role_ai_usage_log.sql`, `select`-only — the ceiling
check only ever reads; `recordAiUsage` still writes via the normal
per-user client, confirmed by writing a verification step that expects
a service-role write attempt to be rejected, not just checking that
reads work.
**Verified against real seeded rows on the local instance, not
assumed:** zero usage → under ceiling; small usage → still under;
usage crossing $1 split across two *different* users → correctly trips
(the aggregate is genuinely cross-user, not accidentally still
per-user); whisper-1's duration pricing computed to the cent (60 real
minutes → exactly $0.36); a lower configured ceiling tripping sooner
than the default; and the service-role write-rejection above. Test rows
seeded via `psql` directly (not the Supabase client), since
`service_role`'s correctly-narrow grants mean the service-role client
itself can't write the fixture data — the setup path and the path
under test are deliberately different mechanisms. Full sweep
(typecheck/lint/test/build) all exit 0.

