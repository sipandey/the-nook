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
