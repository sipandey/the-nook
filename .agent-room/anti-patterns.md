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
