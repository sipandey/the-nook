# Sentry Error Monitoring Implementation Plan

**Goal:** Ship NK-06 (production error monitoring) via Sentry, with an
explicit, verified-safe data-collection configuration — no plaintext,
no local variable values, no session content ever reaches Sentry.

**Architecture:** Standard `@sentry/nextjs` App Router + Turbopack setup
(`instrumentation.ts`, `instrumentation-client.ts`,
`sentry.server.config.ts`, `sentry.edge.config.ts`, `next.config.ts`
wrapped with `withSentryConfig`, `src/app/global-error.tsx`), all
initialized through one shared config object
(`src/lib/monitoring/sentryOptions.ts`) so the privacy configuration is
defined once. Active only in real production (`VERCEL_ENV === "production"`,
the same pattern `src/lib/preview.ts` already uses).

**Reference:** `docs/plans/2026-08-25-sentry-error-monitoring-design.md`
(read first — covers the "why," including the `dataCollection` finding
below). All option names in this plan were checked directly against the
installed `@sentry/nextjs@10.71.0` / `@sentry/core` type definitions in
`node_modules`, not recalled from memory or summarized docs — Sentry's
own doc summaries missed that `dataCollection.stackFrameVariables`
defaults to `true` (local variable *values* sent on crash), which
`sendDefaultPii: false` alone does not prevent.

**Tech stack:** `@sentry/nextjs@^10.71.0` (already installed — see Task
1), Next.js 16 App Router, Turbopack.

---

### Task 1: Package already installed — confirm and commit

**Files:**
- Modify: `web/package.json`, `web/package-lock.json`

**Step 1: Confirm the install**

`@sentry/nextjs` was installed during design research to check its real
type definitions. Confirm it's present:

```bash
cd /Users/sidpande2/Documents/SIDDHARTH/journal/web
grep '"@sentry/nextjs"' package.json
```
Expected: `"@sentry/nextjs": "^10.71.0"` (or similar).

**Step 2: Commit**

```bash
git config user.name "Siddharth Pandey" && git config user.email "siddharth.pandey06@gmail.com"
cd /Users/sidpande2/Documents/SIDDHARTH/journal
git add web/package.json web/package-lock.json
git commit -m "Add @sentry/nextjs dependency"
git log -1 --format='%an <%ae>'
```

---

### Task 2: Shared Sentry options module — the privacy config, TDD

**Files:**
- Create: `web/src/lib/monitoring/sentryOptions.ts`
- Test: `web/src/lib/monitoring/sentryOptions.test.ts`

**Step 1: Write the failing test**

```ts
// web/src/lib/monitoring/sentryOptions.test.ts
import { describe, expect, it } from "vitest";
import {
  SENTRY_DATA_COLLECTION,
  scrubBreadcrumb,
  scrubEvent,
} from "./sentryOptions";

describe("SENTRY_DATA_COLLECTION", () => {
  it("disables stack frame variable capture — the critical setting", () => {
    expect(SENTRY_DATA_COLLECTION.stackFrameVariables).toBe(false);
  });

  it("disables every other data-collection category explicitly", () => {
    expect(SENTRY_DATA_COLLECTION.cookies).toBe(false);
    expect(SENTRY_DATA_COLLECTION.httpHeaders).toEqual({ request: false, response: false });
    expect(SENTRY_DATA_COLLECTION.httpBodies).toEqual([]);
    expect(SENTRY_DATA_COLLECTION.urlQueryParams).toBe(false);
    expect(SENTRY_DATA_COLLECTION.userInfo).toBe(false);
    expect(SENTRY_DATA_COLLECTION.databaseQueryData).toBe(false);
    expect(SENTRY_DATA_COLLECTION.genAI).toEqual({ inputs: false, outputs: false });
  });
});

describe("scrubBreadcrumb", () => {
  it("drops console breadcrumbs entirely", () => {
    expect(scrubBreadcrumb({ category: "console", message: "hello" })).toBeNull();
  });

  it("passes through non-console breadcrumbs unchanged", () => {
    const breadcrumb = { category: "navigation", message: "/write" };
    expect(scrubBreadcrumb(breadcrumb)).toEqual(breadcrumb);
  });

  it("passes through a breadcrumb with no category", () => {
    const breadcrumb = { message: "something" };
    expect(scrubBreadcrumb(breadcrumb)).toEqual(breadcrumb);
  });
});

describe("scrubEvent", () => {
  it("strips request.data, cookies, and headers if present", () => {
    const event = {
      request: {
        data: "some body",
        cookies: { session: "abc" },
        headers: { authorization: "Bearer xyz" },
        url: "https://creator-ai.in/api/entries",
      },
    };
    const result = scrubEvent(event);
    expect(result?.request?.data).toBeUndefined();
    expect(result?.request?.cookies).toBeUndefined();
    expect(result?.request?.headers).toBeUndefined();
    expect(result?.request?.url).toBe("https://creator-ai.in/api/entries");
  });

  it("redacts extra fields whose key matches a sensitive pattern", () => {
    const event = {
      extra: { passphrase: "correct horse battery staple", route: "/write" },
    };
    const result = scrubEvent(event);
    expect(result?.extra?.passphrase).toBe("[redacted]");
    expect(result?.extra?.route).toBe("/write");
  });

  it("redacts sensitive keys case-insensitively and by substring", () => {
    const event = {
      extra: { recoveryPhrase: "ocean velvet prism", entryContent: "dear diary" },
    };
    const result = scrubEvent(event);
    expect(result?.extra?.recoveryPhrase).toBe("[redacted]");
    expect(result?.extra?.entryContent).toBe("[redacted]");
  });

  it("leaves an event with no request or extra untouched", () => {
    const event = { message: "TypeError: x is not a function" };
    expect(scrubEvent(event)).toEqual(event);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22.20.0 >/dev/null
cd /Users/sidpande2/Documents/SIDDHARTH/journal/web
npx vitest run src/lib/monitoring/sentryOptions.test.ts
```
Expected: FAIL — `Cannot find module './sentryOptions'`.

**Step 3: Write minimal implementation**

```ts
// web/src/lib/monitoring/sentryOptions.ts
/**
 * Shared Sentry data-collection policy, imported by every init site
 * (instrumentation-client.ts, sentry.server.config.ts,
 * sentry.edge.config.ts) so it's defined once, not duplicated and left
 * to drift. See docs/plans/2026-08-25-sentry-error-monitoring-design.md
 * for the full "why."
 *
 * `dataCollection`, not `sendDefaultPii`: checked directly against the
 * installed @sentry/core@10.71.0 type definitions (not doc summaries,
 * which missed this) — `sendDefaultPii` is deprecated in this version,
 * and several `dataCollection` categories default to `true`/collecting
 * regardless of `sendDefaultPii`'s value. Most critically,
 * `stackFrameVariables` defaults to `true`: local variable *values* in
 * a crashing function's stack frame, sent as-is. This app holds
 * decrypted journal text in local variables in several places (e.g.
 * write/page.tsx's handleSave() `combined` variable) — a crash while
 * one is in scope would otherwise send the actual plaintext. Every
 * category below is set explicitly; none left to its default.
 */
export const SENTRY_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: false, response: false },
  httpBodies: [] as const,
  urlQueryParams: false,
  databaseQueryData: false,
  stackFrameVariables: false,
  genAI: { inputs: false, outputs: false },
  // frameContextLines intentionally left at its default — surrounding
  // *source code* lines around a crash, not runtime data. This app's
  // own code isn't sensitive; only the data flowing through it is.
};

interface MinimalBreadcrumb {
  category?: string;
  [key: string]: unknown;
}

/**
 * Drops console breadcrumbs entirely — defense against a future
 * console.log (in this codebase or a dependency's) ever touching
 * something sensitive, not a claim that today's code needs it.
 */
export function scrubBreadcrumb<T extends MinimalBreadcrumb>(breadcrumb: T): T | null {
  if (breadcrumb.category === "console") return null;
  return breadcrumb;
}

interface MinimalEvent {
  request?: {
    data?: unknown;
    cookies?: unknown;
    headers?: unknown;
    [key: string]: unknown;
  };
  extra?: Record<string, unknown>;
  [key: string]: unknown;
}

const SENSITIVE_KEY_PATTERN = /passphrase|secret|recovery|text|content|plaintext/i;

/**
 * Second layer beyond SENTRY_DATA_COLLECTION, not a replacement for it:
 * strips request.data/cookies/headers if somehow still present, and
 * redacts any `extra` field whose key matches a known-sensitive
 * pattern — a blunt net against a future mistake, not a claim that
 * today's code passes anything sensitive through `extra` already.
 */
export function scrubEvent<T extends MinimalEvent>(event: T): T {
  if (event.request) {
    const { data: _data, cookies: _cookies, headers: _headers, ...restRequest } = event.request;
    event = { ...event, request: restRequest };
  }
  if (event.extra) {
    const scrubbedExtra: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(event.extra)) {
      scrubbedExtra[key] = SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : value;
    }
    event = { ...event, extra: scrubbedExtra };
  }
  return event;
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/monitoring/sentryOptions.test.ts
```
Expected: PASS — 9 tests passed.

**Step 5: Commit**

```bash
cd /Users/sidpande2/Documents/SIDDHARTH/journal
git add web/src/lib/monitoring/sentryOptions.ts web/src/lib/monitoring/sentryOptions.test.ts
git commit -m "Add Sentry data-collection policy, TDD'd"
```

---

### Task 3: Environment gate helper

**Files:**
- Create: `web/src/lib/monitoring/sentryEnabled.ts`

**Step 1: Write it**

```ts
// web/src/lib/monitoring/sentryEnabled.ts
/**
 * Sentry only actually transmits in real production — never local dev,
 * never a Vercel preview deployment. Same pattern src/lib/preview.ts
 * already uses (VERCEL_ENV, not NODE_ENV — `next start` sets
 * NODE_ENV=production even locally, which would defeat this exact
 * gate). VERCEL_ENV is one of the small set of Vercel-provided system
 * env vars Next.js exposes to both server and client code without a
 * NEXT_PUBLIC_ prefix — confirmed by this exact pattern already
 * working correctly in preview.ts, used from client components.
 */
export const SENTRY_ENABLED = process.env.VERCEL_ENV === "production";
```

No test — this is a one-line environment check with no branching logic
to assert against beyond what TypeScript already guarantees.

**Step 2: Commit**

```bash
git add web/src/lib/monitoring/sentryEnabled.ts
git commit -m "Add Sentry production-only environment gate"
```

---

### Task 4: Server and edge Sentry init

**Files:**
- Create: `web/sentry.server.config.ts`
- Create: `web/sentry.edge.config.ts`

**Step 1: Write both**

```ts
// web/sentry.server.config.ts
import * as Sentry from "@sentry/nextjs";
import { SENTRY_DATA_COLLECTION, scrubBreadcrumb, scrubEvent } from "./src/lib/monitoring/sentryOptions";
import { SENTRY_ENABLED } from "./src/lib/monitoring/sentryEnabled";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: SENTRY_ENABLED,
  sendDefaultPii: false,
  dataCollection: SENTRY_DATA_COLLECTION,
  beforeBreadcrumb: scrubBreadcrumb,
  beforeSend: scrubEvent,
});
```

```ts
// web/sentry.edge.config.ts
import * as Sentry from "@sentry/nextjs";
import { SENTRY_DATA_COLLECTION, scrubBreadcrumb, scrubEvent } from "./src/lib/monitoring/sentryOptions";
import { SENTRY_ENABLED } from "./src/lib/monitoring/sentryEnabled";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: SENTRY_ENABLED,
  sendDefaultPii: false,
  dataCollection: SENTRY_DATA_COLLECTION,
  beforeBreadcrumb: scrubBreadcrumb,
  beforeSend: scrubEvent,
});
```

**Step 2: Typecheck**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22.20.0 >/dev/null
cd /Users/sidpande2/Documents/SIDDHARTH/journal/web
npx tsc --noEmit -p . 2>&1 | grep -i sentry || echo "no errors in Sentry config files"
```
Expected: no errors referencing these two files. (`dataCollection`,
`beforeBreadcrumb`, `beforeSend` option names and shapes were verified
directly against the installed package's types in Task 2 — if this
step reports a type mismatch, re-check `node_modules/@sentry/core/build/types/types/options.d.ts`
and `datacollection.d.ts` for what actually changed, don't just loosen
the types to make it compile.)

**Step 3: Commit**

```bash
git add web/sentry.server.config.ts web/sentry.edge.config.ts
git commit -m "Add Sentry server and edge runtime config"
```

---

### Task 5: `instrumentation.ts` — dispatch by runtime, capture request errors

**Files:**
- Create: `web/instrumentation.ts`

**Step 1: Write it**

```ts
// web/instrumentation.ts
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
```

**Step 2: Typecheck**

```bash
cd /Users/sidpande2/Documents/SIDDHARTH/journal/web
npx tsc --noEmit -p . 2>&1 | grep -i instrumentation || echo "no errors"
```
Expected: no errors.

**Step 3: Commit**

```bash
git add web/instrumentation.ts
git commit -m "Add instrumentation.ts to register Sentry per runtime"
```

---

### Task 6: `instrumentation-client.ts` — browser init

**Files:**
- Create: `web/instrumentation-client.ts`

**Step 1: Write it**

```ts
// web/instrumentation-client.ts
import * as Sentry from "@sentry/nextjs";
import { SENTRY_DATA_COLLECTION, scrubBreadcrumb, scrubEvent } from "@/lib/monitoring/sentryOptions";
import { SENTRY_ENABLED } from "@/lib/monitoring/sentryEnabled";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: SENTRY_ENABLED,
  sendDefaultPii: false,
  dataCollection: SENTRY_DATA_COLLECTION,
  beforeBreadcrumb: scrubBreadcrumb,
  beforeSend: scrubEvent,
  // No replayIntegration() call anywhere in this file, deliberately —
  // see the design doc's "No Session Replay" decision. Not "disabled,"
  // never added.
});
```

**Step 2: Typecheck**

```bash
cd /Users/sidpande2/Documents/SIDDHARTH/journal/web
npx tsc --noEmit -p . 2>&1 | grep -i "instrumentation-client" || echo "no errors"
```
Expected: no errors.

**Step 3: Commit**

```bash
git add web/instrumentation-client.ts
git commit -m "Add instrumentation-client.ts for browser Sentry init"
```

---

### Task 7: Wrap `next.config.ts` with `withSentryConfig`

**Files:**
- Modify: `web/next.config.ts`

**Step 1: Update it**

Change:

```ts
import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  /* config options here */
};

// @serwist/next (the webpack-based Serwist integration) silently no-ops
// under Turbopack, which this app uses for both `next dev` and `next
// build` — @serwist/turbopack is the maintainer-recommended alternative
// for exactly that case. See docs/ROADMAP.md NK-07 and src/app/sw.ts.
export default withSerwist(nextConfig);
```

to:

```ts
import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

// @serwist/next (the webpack-based Serwist integration) silently no-ops
// under Turbopack, which this app uses for both `next dev` and `next
// build` — @serwist/turbopack is the maintainer-recommended alternative
// for exactly that case. See docs/ROADMAP.md NK-07 and src/app/sw.ts.
//
// withSentryConfig wraps withSerwist's output, not the other way
// around, so both plugins' build-time work happens (Sentry's source-map
// handling, Serwist's service-worker generation). Confirmed via
// research that @sentry/nextjs supports Turbopack (SDK ≥9.9.0, Next.js
// ≥15.3.0-canary.8 — this app is on 16.3.2, well past both) — but that
// "Turbopack doesn't support webpack-specific Sentry configuration
// options," so only well-established, non-webpack-only options are
// used here. No org/project/authToken set: without them the plugin
// skips source-map upload gracefully (readable stack traces in the
// Sentry dashboard are a real follow-up once there's a Sentry auth
// token to configure, not required for error capture itself to work)
// — see docs/ROADMAP.md NK-06's note on this.
export default withSentryConfig(withSerwist(nextConfig), {
  silent: true,
  disableLogger: true,
  widenClientFileUpload: false,
});
```

**Step 2: Typecheck and confirm the build isn't broken**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22.20.0 >/dev/null
cd /Users/sidpande2/Documents/SIDDHARTH/journal/web
npm run typecheck
```
Expected: exit 0. (The full build is verified in Task 9 — this step
just confirms the config composes without a type error.)

**Step 3: Commit**

```bash
git add web/next.config.ts
git commit -m "Wrap next.config.ts with withSentryConfig"
```

---

### Task 8: `global-error.tsx` — React render error boundary

**Files:**
- Create: `web/src/app/global-error.tsx`

**Step 1: Write it**

```tsx
// web/src/app/global-error.tsx
"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * The one class of error instrumentation.ts's onRequestError and the
 * browser SDK's automatic instrumentation don't otherwise reach: a
 * React rendering error at the root of the App Router. Deliberately
 * minimal and calm — no stack trace or technical detail shown to the
 * user, matching the tone of this app's other error states (e.g.
 * UnlockGate's "Couldn't reach your journal" message).
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-full flex items-center justify-center bg-background px-6 text-center">
        <p className="text-sm text-on-surface-variant">
          Something went wrong. Try reloading — nothing about your journal has
          been lost.
        </p>
      </body>
    </html>
  );
}
```

**Step 2: Typecheck**

```bash
cd /Users/sidpande2/Documents/SIDDHARTH/journal/web
npx tsc --noEmit -p . 2>&1 | grep -i "global-error" || echo "no errors"
```
Expected: no errors.

**Step 3: Commit**

```bash
git add web/src/app/global-error.tsx
git commit -m "Add global-error.tsx Sentry error boundary"
```

---

### Task 9: `data-sentry-mask` on sensitive inputs

**Files:**
- Modify: `web/src/components/unlock/PassphraseUnlock.tsx`
- Modify: `web/src/components/unlock/PassphraseSetup.tsx`
- Modify: `web/src/app/(app)/write/page.tsx`

**Step 1: `PassphraseUnlock.tsx`**

Add `data-sentry-mask` to both the passphrase `<input type="password">`
and the recovery-phrase `<textarea>`:

```tsx
<input
  id="password"
  type="password"
  value={secret}
  onChange={(e) => setSecret(e.target.value)}
  onKeyDown={(e) => e.key === "Enter" && secret && !submitting && submit()}
  placeholder="Passphrase"
  autoFocus
  data-sentry-mask
  className="w-full bg-transparent border-0 border-b border-outline-variant px-0 pb-3 text-center text-body-lg text-on-surface focus:ring-0 focus:border-primary placeholder:text-outline-variant transition-colors"
/>
```

```tsx
<textarea
  value={secret}
  onChange={(e) => setSecret(e.target.value)}
  placeholder="ocean velvet prism silent quartz dawn echo lunar timber silver ember bloom"
  rows={3}
  autoFocus
  data-sentry-mask
  className="w-full resize-none bg-transparent border-0 border-b border-outline-variant px-0 py-3 text-center text-body-md text-on-surface focus:ring-0 focus:border-primary placeholder:text-outline-variant transition-colors"
/>
```

**Step 2: `PassphraseSetup.tsx`**

Read the file first to find its passphrase/recovery-phrase-display
elements (a fresh read is needed here — this file wasn't in this
session's working context recently, so exact current line numbers
aren't known ahead of time). Add `data-sentry-mask` to: the new-
passphrase input, the confirm-passphrase input, and the element that
displays the generated 12-word recovery phrase.

**Step 3: `write/page.tsx`**

Add `data-sentry-mask` to the title input and the composer textarea:

```tsx
<input
  value={title}
  onChange={(e) => setTitle(e.target.value)}
  placeholder="Title (optional)"
  data-sentry-mask
  className="w-full bg-transparent border-0 border-b border-transparent focus:border-outline-variant focus:ring-0 px-0 py-2 font-editorial-display text-title-md text-on-surface placeholder:text-outline/50 transition-colors mb-4"
/>
```

```tsx
<textarea
  value={text}
  onChange={(e) => setText(e.target.value)}
  placeholder={isAppendMode ? "Add another thought…" : "Start writing…"}
  autoFocus
  data-sentry-mask
  className="w-full h-full flex-1 bg-transparent border-none resize-none focus:ring-0 p-0 text-body-lg text-on-surface placeholder:text-on-surface-variant/40 leading-relaxed outline-none"
/>
```

**Step 4: Typecheck and lint**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22.20.0 >/dev/null
cd /Users/sidpande2/Documents/SIDDHARTH/journal/web
npm run typecheck
npm run lint
```
Expected: both exit 0 (`data-*` attributes are always valid on any
element — no new lint surface).

**Step 5: Commit**

```bash
git add web/src/components/unlock/PassphraseUnlock.tsx web/src/components/unlock/PassphraseSetup.tsx "web/src/app/(app)/write/page.tsx"
git commit -m "Add data-sentry-mask to passphrase, recovery, and composer inputs"
```

---

### Task 10: Environment variables

**Files:**
- Modify: `web/.env.example`
- Modify (not committed — gitignored): `web/.env.local`

**Step 1: `.env.example`**

Add, matching this file's existing per-vendor comment convention:

```
# Sentry — https://sentry.io (production error monitoring, NK-06)
# DSN is not secret (safe to expose client-side per Sentry's own
# security model) but still project-specific — see
# docs/plans/2026-08-25-sentry-error-monitoring-design.md for the full
# privacy configuration this app applies around it.
NEXT_PUBLIC_SENTRY_DSN=
```

**Step 2: `.env.local`**

Add the real DSN the user provided directly in conversation (not
committed — `.gitignore` already excludes `.env*` except `.env.example`):

```
NEXT_PUBLIC_SENTRY_DSN=<the DSN provided in this session>
```

**Step 3: Commit only `.env.example`**

```bash
git status --porcelain  # confirm .env.local does NOT appear
git add web/.env.example
git commit -m "Document NEXT_PUBLIC_SENTRY_DSN in .env.example"
```

**Step 4: Note for the user — Vercel production env var**

This step needs the user directly; it's their Vercel dashboard access,
not something achievable from this session. State plainly at the end of
this plan's execution: they need to add `NEXT_PUBLIC_SENTRY_DSN` (same
value) to Vercel's Project Settings → Environment Variables, scoped to
Production, before this actually activates in real production —
`SENTRY_ENABLED`'s `VERCEL_ENV === "production"` gate means it's
harmless if forgotten (nothing sends, same as today), but the whole
point of this feature is inert until that's done.

---

### Task 11: Full sweep, live verification, docs, final commit

**Step 1: Full project sweep**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22.20.0 >/dev/null
cd /Users/sidpande2/Documents/SIDDHARTH/journal/web
echo "=== typecheck ===" && npm run typecheck > /tmp/sentry-tc.log 2>&1; echo "exit: $?"
echo "=== lint ===" && npm run lint > /tmp/sentry-lint.log 2>&1; echo "exit: $?"
echo "=== test ===" && npm test > /tmp/sentry-test.log 2>&1; echo "exit: $?"
rm -rf .next
OPENAI_API_KEY=sk-ci-placeholder-not-a-real-key npm run build > /tmp/sentry-build.log 2>&1; echo "exit: $?"
```
Expected: all four exit 0. Check each log directly — a Sentry build
plugin can print noisy warnings (e.g. about missing `authToken` for
source maps) without those being build *failures*; confirm the actual
exit code, don't infer success from clean-looking output alone.
`rm -rf .next` after.

**Step 2: Live verification — preview mode stays silent**

```bash
cd /Users/sidpande2/Documents/SIDDHARTH/journal/web
lsof -ti:3100 | xargs -r kill -9 2>/dev/null
NEXT_PUBLIC_PREVIEW_MODE=1 OPENAI_API_KEY=sk-ci-placeholder-not-a-real-key npm run build
NEXT_PUBLIC_PREVIEW_MODE=1 PORT=3100 nohup npm start > /tmp/sentry-preview-server.log 2>&1 &
disown
```

Using the Browser pane: navigate to `/`, `/write`, `/settings`; trigger
a deliberate error if convenient (e.g. temporarily throw in a click
handler, revert after). Confirm via `read_network_requests` with
`urlPattern` matching `sentry` that **zero** requests reach any
`*.sentry.io`/`*.ingest.*.sentry.io` origin — `VERCEL_ENV` is unset
locally, so `SENTRY_ENABLED` is `false` regardless of what else is
configured. Confirm `data-sentry-mask` is present on the passphrase
input, recovery textarea, and composer title/text fields via
`read_page` or a `querySelector` check.

**Step 3: Live verification — a real send actually works**

Temporarily hardcode `SENTRY_ENABLED = true` in
`src/lib/monitoring/sentryEnabled.ts` (revert immediately after — same
add-then-revert technique used for the auto-lock and Home-skeleton
verifications this session), rebuild, trigger a deliberate test error,
confirm via `read_network_requests` that a request to the DSN's
`*.sentry.io` ingest origin actually succeeds (2xx). Revert the
temporary change and confirm via `git diff` that `sentryEnabled.ts`
matches Task 3's committed version exactly before moving on. Actually
seeing the event land in the Sentry dashboard is the user's own
follow-up — not something this session can log into their account to
confirm.

**Step 4: Update docs**

- `web/README.md` — add a bullet under "What's built" for production
  error monitoring, and update the known-gaps list to remove NK-06.
- `docs/ARCHITECTURE.md` — a short note (§8 or wherever the gap was
  tracked) resolving the "no error monitoring" gap, pointing at
  `src/lib/monitoring/sentryOptions.ts` for the actual policy.
- `.agent-room/decisions.md` — a closing-the-loop entry (`###
  YYYY-MM-DD — title` / `**Decision:**` / `**Why:**`) covering: the
  `dataCollection` vs `sendDefaultPii` finding and why it mattered
  enough to revise the approved design mid-implementation; the no-
  Session-Replay decision; the `data-sentry-mask` defense-in-depth
  choice; and that source-map upload (readable stack traces) was
  deliberately deferred, not forgotten, pending a Sentry auth token the
  user would need to generate.

**Step 5: Verify the close-the-loop hook passes**

```bash
cd /Users/sidpande2/Documents/SIDDHARTH/journal
node .agent-room/hooks/close-the-loop-check.js < /dev/null; echo "exit: $?"
```
Expected: exit 0.

**Step 6: Update `docs/ROADMAP.md`**

Mark NK-06 Done, with a summary matching the style of NK-20/21/22's
entries — what was built, the `dataCollection` finding, what's
deliberately deferred (source maps).

**Step 7: Final commit**

```bash
git config user.name "Siddharth Pandey" && git config user.email "siddharth.pandey06@gmail.com"
git add web/README.md docs/ARCHITECTURE.md docs/ROADMAP.md .agent-room/decisions.md
git commit -m "Document Sentry error monitoring (NK-06)"
git log -1 --format='%an <%ae>'
```

**Do not push** until the user explicitly says so — matches every prior
turn's pattern in this session. **Do not consider this fully live**
until the user confirms they've added `NEXT_PUBLIC_SENTRY_DSN` to
Vercel's real production environment variables — say this plainly when
reporting completion.
