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

