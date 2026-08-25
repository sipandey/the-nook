# Anti-Patterns Log — journal

Negative knowledge: things that have already gone wrong here, so nobody
(human or agent) repeats them. One avoided bug is worth more than one
polished example — keep entries short and concrete.

Append a new entry every time:
- a bug slips through and you find the root cause,
- an approach seemed reasonable but turned out wrong,
- a fix gets reverted because it only patched a symptom.

## Format

```
### YYYY-MM-DD — short title

**What happened:** one or two sentences.
**Root cause:** the actual cause, not the symptom.
**Avoid:** the concrete rule that would have prevented it.
```

<!-- Entries go below this line, newest first. -->

### 2026-08-24 — Overriding a `NEXT_PUBLIC_*` env var at `next start` time silently does nothing

**What happened:** While verifying NK-10's cron route against a local Supabase
stack, tried to point `NEXT_PUBLIC_SUPABASE_URL` at `http://127.0.0.1:54321`
by setting it only when running `next start` (first via inline shell env vars,
then via `node --env-file=...` after suspecting shell-escaping corruption of
the long JWT service-role key). Neither worked — the app kept talking to the
real hosted Supabase project. A route that used a *non*-`NEXT_PUBLIC_` var
(`CRON_SECRET`, read at request time) picked up the override correctly in the
exact same run, which is what made the contradiction obvious enough to chase
down instead of assuming a shell-quoting bug.
**Root cause:** Next.js inlines `NEXT_PUBLIC_*` variables at *build* time —
via static replacement in the compiled output — everywhere, including
server-only Route Handler code, not just client bundles. The value baked in
during `next build` is permanent for that build artifact; no environment
variable set at `next start` (or any runtime) can change it afterward, no
matter how correctly it's passed.
**Avoid:** To point a build at different `NEXT_PUBLIC_*` values (e.g. testing
against a local Supabase stack instead of the real project), the override has
to be present at *build* time — rebuild with the value exported in the
build's own shell environment. Setting it only for `next start`, by any
mechanism, is a silent no-op. If a `NEXT_PUBLIC_*` override appears to have no
effect, check this before suspecting anything else (shell escaping, caching,
`.env.local` precedence) — a same-run comparison against a plain server-only
var is the fastest way to confirm it's this and not something else.

### 2026-08-24 — Notification permission prompts can't be granted via browser automation, ever — don't retry

**What happened:** While verifying NK-09 (Web Push subscription), tried to get
`Notification.requestPermission()` to actually resolve in real Chrome via
Claude in Chrome — first as a direct script call, then from inside a
`computer`-tool-dispatched click on a real button injected into the page (to
rule out a missing-user-gesture cause). Neither ever resolved;
`Notification.permission` stayed `"default"` indefinitely both times.
**Root cause:** Not a bug, not an automation-tool limitation to work around —
Chrome deliberately requires an *unspoofable* user gesture for
security-sensitive permission prompts (notifications, camera, microphone,
geolocation), specifically so no automation layer, extension, or synthetic
event can auto-approve them on a user's behalf. A CDP/extension-dispatched
click is not, and structurally cannot be, sufficient — this is the security
boundary working as intended, not a false negative like the NK-07 SW
registration issue turned out to be.
**Avoid:** Don't spend time trying to automate past a notification (or
camera/mic/geolocation) permission prompt in any browser automation tool —
direct script calls, synthetic clicks, dispatched events, none of it will
work, in any browser, automated or not. Verify everything *except* the actual
grant (code correctness, build output, wiring, no-regression checks on
adjacent features), then hand the one remaining step to a human explicitly
rather than retrying automation approaches against it.

### 2026-08-24 — Service worker registration fails in the automated Browser pane even when the app is correct

**What happened:** While verifying NK-07 (registering a service worker via
`@serwist/turbopack`), `navigator.serviceWorker.register()` failed in the
automated Browser pane with Chromium's generic "unknown error occurred when
fetching the script" — even though the server returned a clean 200 with correct
headers, `redirect: 'manual'` proved no redirect occurred, and switching between
`type: "module"` and `type: "classic"` made no difference. `read_network_requests`
confirmed the browser's own fetch for the exact script completed successfully at
the network layer. The identical, unmodified code then registered and activated
cleanly in a real (non-automated) Chrome session via Claude in Chrome, with a
full offline-behavior test (server process killed, not just DevTools' offline
toggle) passing.
**Root cause:** Not established with certainty, but the failure signature — a
successful network-layer fetch (confirmed via CDP's own Network domain) paired
with a browser-API-layer rejection specifically on `serviceWorker.register()` —
matches a known class of friction between CDP-driven browser automation and the
internal script-fetch algorithm Chromium uses for service worker installation
(a different code path from a page's own `fetch()`, run outside normal
same-origin interception). Nothing server-side was changed between the failing
and passing runs.
**Avoid:** Don't conclude a service-worker/PWA feature is broken from a failure
in the automated Browser pane alone, especially with this exact signature
(network request succeeds per `read_network_requests`, but
`register()`/`getRegistrations()` still reports failure or empty). Cross-check in
a real, non-automated browser (Claude in Chrome, or ask the user to check
locally) before spending further effort chasing it as an app bug — and don't
claim "verified" based on the automated pane's result either way for this
specific API, since it has demonstrably given a false negative here.

### 2026-08-24 — `npm run lint 2>&1 | tail -N; echo $?` reported exit 0 for a command that actually failed

**What happened:** While verifying NK-04's CI pipeline, `npm run lint 2>&1 | tail -30`
followed by `echo "lint exit: $?"` printed `lint exit: 0` — even though the same
output showed `2 errors`. Nearly concluded lint was passing and moved on before a
second, direct check (`npm run lint > file.txt 2>&1; echo $?`, no pipe) revealed the
real exit code was `1`.
**Root cause:** In a shell pipeline (`cmd1 | cmd2`), `$?` after the pipeline reflects
the *last* command's exit status — `tail`, which almost always exits 0 — not
`cmd1`'s. This applies to every `... | tail` / `... | head` / `... | grep` pattern
used to trim command output in this session, not just this one lint check.
**Avoid:** Never read `$?` after a piped command when the exit code matters.
Redirect to a file (or use `set -o pipefail` for the whole script) and check the
exit code separately: `cmd > out.txt 2>&1; echo $?; tail -30 out.txt`. If truncated
output was already read via a pipe and the result looked clean, don't trust it —
re-run with a direct exit-code check before treating a step as green.

### 2026-08-24 — Committing before turn-end makes the close-the-loop hook vacuously pass

**What happened:** Two consecutive decisions.md entries (the brand-logo one and the
roadmap one) were written with `##` headings and no `**Decision:**` field, against a
file whose other 24 entries all use `### YYYY-MM-DD — title` plus `**Decision:**` /
`**Why:**`. The first one shipped to `main` undetected; the hook only rejected the
second. The inconsistency in *when* the hook fires was the confusing part, not the
formatting mistake itself.
**Root cause:** `close-the-loop-check.js` reads `git status --porcelain` and returns
`ok: true` immediately when no non-scaffold paths are dirty — before it ever calls
`validateLogEvidenceFromDiff`. In the logo turn, everything (including decisions.md)
was committed and pushed *within the turn*, so the working tree was clean at Stop
time and the evidence check never ran. In the roadmap turn the files were left
uncommitted for review, so validation actually executed and caught the malformed
entry. The hook therefore validates entry quality only for work left uncommitted; any
turn that commits before ending skips the check entirely.
**Avoid:** Don't treat "the Stop hook passed" as evidence that a decisions.md or
anti-patterns.md entry is well-formed — it only means the check ran *or* was skipped.
Match the file's existing entry format by reading a neighbouring entry first. The
required shape is exact and machine-checked: heading must be `###` (not `##`), and a
decision entry needs **both** `**Decision:**` and `**Why:**` (`.every`), while an
anti-pattern entry needs only one of `**What happened:**` / `**Root cause:**` /
`**Avoid:**` (`.some`) — see `.agent-room/hooks/closing-the-loop-evidence.js`.

### 2026-08-24 — Custom domain redirected to Clerk's hosted Account Portal instead of this app's own /sign-in

**What happened:** After moving Clerk to a production instance on the new custom domain
(`creator-ai.in`), visiting the site as a signed-out user redirected to
`https://accounts.the-nook-lime.vercel.app/sign-in?redirect_url=...` — a URL on the
*old* Vercel project domain, not the new custom domain, and not this app's own
hand-built `/sign-in` page at all.
**Root cause:** `signInUrl`/`signUpUrl` were never explicitly configured anywhere —
not on `ClerkProvider`, not on `clerkMiddleware()`, not as env vars. This app has
always used custom-built `/sign-in` and `/sign-up` pages (never Clerk's hosted UI), but
without an explicit `signInUrl`, `auth.protect()`'s redirect for an unauthenticated
visitor falls back to Clerk's hosted Account Portal — which had been auto-configured
against the original `.vercel.app` project domain and never got told about the new
custom domain. This had been silently relying on default/fallback behavior the whole
time; it only became visible once the instance switched to production and the fallback
target stopped matching where the app actually lives.
**Avoid:** When an app has custom-built auth pages and deliberately never uses a
provider's hosted UI, say so explicitly in config (`signInUrl`/`signUpUrl` here) —
don't rely on the provider's fallback/auto-detected default matching intent, even if it
happens to work by coincidence in one environment. A fallback that currently resolves
correctly by accident is still a latent bug, and domain/environment changes are exactly
what exposes it.

### 2026-08-24 — Built the wrong Clerk production-domain mechanism from an in-progress dashboard screenshot

**What happened:** Configured `clerkMiddleware()`/`ClerkProvider` to route Clerk's
Frontend API through this app's own `/__clerk` path (the "app proxy" method), based on
a Clerk dashboard checklist screenshot showing "Configure app proxy — Proxy Clerk
through /__clerk" with Frontend App URL `https://the-nook-lime.vercel.app/__clerk`.
Once the `creator-ai.in` domain migration actually completed and Clerk issued a fresh
publishable key, every Clerk API call started failing with `400 host_invalid`, on both
`www.creator-ai.in` and plain `creator-ai.in` — ruling out a www/apex mismatch as the
cause (that was fixed first and made no difference). Root-caused by decoding the live
publishable key (`atob()` on the base64 portion after `pk_live_`): it resolved to
`clerk.creator-ai.in$` — a *dedicated subdomain*, not this app's own domain. Confirmed
by querying `https://clerk.creator-ai.in/v1/environment` directly, bypassing the app
entirely: it returned a fully correct Clerk environment response. The DNS CNAME records
set up earlier (`clerk`, `clk._domainkey`, `clk2._domainkey`, `clkmail`, all pointing at
`*.clerk.services`) were for exactly this — the DNS-subdomain method — not the app-proxy
method. The two are mutually exclusive; running the app-proxy code on top of a
DNS-subdomain-scoped key forced every request through this app's own middleware instead
of letting it reach `clerk.creator-ai.in` directly, where it would have been correctly
attributed.
**Root cause:** Treated an early, in-progress dashboard checklist screenshot as a
durable description of the target architecture, rather than a snapshot of one point in
a multi-step migration. The screenshot's own Frontend App URL
(`the-nook-lime.vercel.app`, the *old* domain) was the tell that it described a
pre-migration state, but that detail wasn't weighed heavily enough against the
checklist's proxy-specific wording.
**Avoid:** When a dashboard screenshot specifies a mechanism (proxy vs. DNS subdomain,
etc.), check whether any domain/URL visible in that same screenshot is stale before
building against it — a stale URL is a strong signal the whole screenshot is a
mid-migration snapshot, not the end state. For Clerk specifically: the publishable key
itself is the ground truth for which Frontend API domain/mechanism is actually active
(`atob()` the part after `pk_live_`/`pk_test_`) — decode it and verify against that
before trusting a dashboard screenshot's implied setup, especially after any domain or
instance change where a new key gets issued.

### 2026-08-25 — Migrations verified against local Supabase only, never confirmed against the real hosted project — production went down

**What happened:** Every API route started returning 500 in production
(`/api/entries` and others) right after the NK-16 (append-to-today's-entry)
and NK-20 (font performance) commits deployed. The user couldn't save or
view entries at all. Root cause, confirmed once they ran a migration in
Supabase's SQL editor and hit `relation "push_subscriptions" does not
exist`: the hosted Supabase project's schema was missing migrations
`0006` through `0010` entirely — not just `0009`/`0010` from today, but
`0006_push_subscriptions.sql` from NK-09, several sessions ago. Every one
of those migrations had been written, tested, and verified thoroughly —
against a **local** Docker Postgres instance (`supabase db reset`), the
pattern this entire session standardized on for good reason (fast,
reproducible, no risk to real data). But "verified locally" was silently
treated as equivalent to "verified," and no step in this session's
workflow ever confirmed the same migrations had actually reached the
real hosted database the production deployment talks to. The gap had
been latent since NK-09 — it only became a full outage once `0009` added
a column (`entries.updated_at`) that a route handler's `SELECT` started
depending on unconditionally.
**Root cause:** Local-Supabase-CLI verification (`supabase db reset` +
direct `psql` checks) is genuinely rigorous for *"does this SQL do what I
intend, against a real Postgres"* — every migration this session wrote
was checked that way, correctly. But it answers a different question
than *"has this SQL actually been applied to the database production
queries against"* — and this session's decisions.md entries had already
noticed the shape of this gap twice before (NK-10's `0008` and NK-16's
`0010`, both discovered via local-only testing, both with an explicit
note that "whether the real hosted project already has these grants is
unverified") without ever closing it structurally. A repeatedly-flagged,
never-fixed process gap is exactly the kind that eventually causes a real
outage.
**Avoid:** Local Supabase CLI verification and hosted-project migration
state are two separate facts — track them separately, and don't let
"verified locally" read as "deployed." Before or immediately after a
migration-touching commit reaches production, run `supabase migration
list` (read-only, safe) against the *linked hosted project* to confirm
what's actually applied there, not just what exists as a file in
`supabase/migrations/`. If this project ever gets a real deploy pipeline,
`supabase db push` against the hosted project belongs in it, gated the
same way `next build` already is in CI — a migration file merged to
`main` should not be able to sit unapplied against production
indefinitely with nothing surfacing that fact.

### 2026-08-25 — The append-to-today's-entry gate silently defaulted to "no entry today" during a real fetch failure, creating duplicate entries

**What happened:** During the outage above, `/api/entries` was 500ing
for the affected user, but the write composer let them save several new
entries anyway — instead of appending to today's (already-existing)
entry, each save created a brand-new one, leaving multiple entries dated
today once the outage was fixed. "Continue today's entry" now only
finds/appends to the most recent of them (`getTodaysEntry`'s documented,
deliberate "most recent wins" behavior from the NK-16 design), silently
orphaning the earlier duplicates from the append flow — not lost, still
visible in Journal, just no longer reachable through the append
convenience path.
**Root cause:** `write/page.tsx` computed `appendTarget` from
`entries ?? []` — collapsing two genuinely different states, "the fetch
hasn't resolved yet or failed" and "this user genuinely has zero entries
today," into the same fallback value. `useEntries()` (via React Query)
exposes `isLoading`/`isError` for exactly this distinction, but the
composer only ever destructured `data`. The failure mode this produces
is asymmetric and easy to miss in normal testing: on the happy path
(fetch succeeds), nothing looks wrong at all — the bug is invisible until
the exact moment a fetch genuinely fails while the user is actively
trying to write, which is also the worst possible moment for the app to
guess wrong.
**Avoid:** When a UI decision determines whether a write mutates existing
data or creates new data (append vs. insert, update vs. duplicate), gate
the *action*, not just the read, on the query's full state — `isLoading`/
`isError`, not just `data ?? fallback`. A `?? []`/`?? null` fallback is
fine for *rendering* something reasonable while state is unknown; it is
not fine for *deciding* something irreversible while state is unknown.
Fixed by tracking `entriesStatusKnown = !entriesLoading && !entriesError`
and disabling Save (with a clear "couldn't check today's entries, saving
paused" message) until it's true — matching the same defensive pattern
`UnlockGate.tsx` already uses for its own key-material fetch.

### 2026-08-25 — Home's populated-state `<main>` never reserved space for the fixed BottomTabBar

**What happened:** Reported alongside the outage above (unrelated root
cause, just noticed at the same time): the user couldn't scroll far
enough on Home to see the last "Recent Thoughts" entries — not just
obscured, genuinely unreachable by scrolling.
**Root cause:** `src/app/(app)/page.tsx`'s populated-state `<main>` used
`pb-3` (12px) — nowhere near enough clearance for `BottomTabBar`, which
is `fixed bottom-0`. Every sibling screen that renders `BottomTabBar`
(`journal/page.tsx`: `pb-24`, `manifestations/page.tsx`: `pb-32`,
`playback/page.tsx`: `pb-32`) — including Home's *own* `EmptyHome`
variant, `pb-24` — correctly reserves real space; only the populated
Home layout was ever an outlier. Because a `fixed` element doesn't
participate in document flow, insufficient bottom padding doesn't just
visually crowd the last item — it makes the page's total scrollable
height end right where the bar begins, so there's nothing further to
reveal by scrolling past it.
**Avoid:** A `fixed` bottom nav shared across screens needs the same
bottom-padding convention applied everywhere it's rendered — check
sibling screens for the established value (`pb-24`+ here) rather than
picking a number per-page. This one likely predates any of this
session's work and had just never been noticed with few enough entries
to not matter; worth a quick grep (`grep -rn "BottomTabBar" src/app`)
after any future layout change to confirm every renderer still matches.

### 2026-08-25 — A bare (non-`NEXT_PUBLIC_`) env var read client-side silently evaluates to `undefined`, with no error

**What happened:** After shipping Sentry error monitoring (NK-06) and
deploying, a deliberately-triggered test error on the real production
site never reached Sentry — no request, no error, nothing. Investigated
by intercepting the actual client SDK's resolved options in the browser
(`window.__SENTRY__`'s registered client's `_options`), not by guessing:
`enabled: false`, on `https://creator-ai.in`, in real production. The
DSN, `dataCollection` scrubbing config, and everything else was correct
— only `enabled` was wrong.
**Root cause:** `src/lib/monitoring/sentryEnabled.ts` gates on
`process.env.VERCEL_ENV === "production"`, mirroring
`src/lib/preview.ts`'s existing `!process.env.VERCEL_ENV` check — reused
as an established, already-working pattern. It wasn't actually proven to
work client-side: `preview.ts`'s check is `AND`-ed with a second,
`NEXT_PUBLIC_`-prefixed condition that's never true in real production
regardless, so that code path produces the correct *result* in
production whether or not `VERCEL_ENV` is actually readable in the
browser — the bug was latent and invisible there. Sentry's gate had no
such second condition, so the same underlying gap became a real, visible
bug the moment nothing else was masking it. The actual mechanism: Vercel
sets `VERCEL_ENV` server-side/at build time automatically (confirmed
against Vercel's own docs), but Next.js never inlines a bare,
non-`NEXT_PUBLIC_`-prefixed `process.env.*` reference into client-side
code on its own — confirmed against this Next.js version's own bundled
docs (`node_modules/next/dist/docs/.../config/env.md`), not assumed.
Client-side, `process.env.VERCEL_ENV` was simply `undefined`, everywhere,
including real production.
**Fixed** via `next.config.ts`'s documented `env` field —
`env: { VERCEL_ENV: process.env.VERCEL_ENV }` — which explicitly
whitelists a build-time-known value for inclusion in the client bundle,
independent of its name. Verified by building locally with
`VERCEL_ENV=production` set (simulating the real Vercel build
environment) and grepping the actual compiled client chunk for the
literal `enabled:!0` (minified `true`) next to the real DSN string —
not assumed fixed from the diff alone.
**Avoid:** A `process.env.X` read with no `NEXT_PUBLIC_` prefix is
silently `undefined` in any client-side/browser code path, full stop —
there is no automatic exception for Vercel's own system variables just
because Vercel documents them as "available at build and runtime" (that
availability is scoped to the server/build process, not the shipped
browser bundle). Don't infer a pattern is proven correct from "the
overall behavior looks right" when a second, independent condition could
be silently carrying the correct result on its own — trace whether the
*specific* variable you're about to reuse the pattern for was ever
actually exercised, not just whether the code that uses it happened to
produce the right answer. When in doubt, verify by reading the actual
compiled output for the literal value, in the actual target environment
— not by reasoning about what "should" happen.
