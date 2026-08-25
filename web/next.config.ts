import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Exposes the server/build-time VERCEL_ENV value to client-side code
  // under the same key name — required for src/lib/monitoring/sentryEnabled.ts
  // (and, defensively, src/lib/preview.ts's already-shipped check) to
  // read process.env.VERCEL_ENV correctly in the browser bundle. Vercel
  // makes VERCEL_ENV available server-side/at build time automatically,
  // but Next.js never inlines a bare (non-NEXT_PUBLIC_-prefixed) env var
  // into client code on its own — confirmed live against the real
  // production deployment: Sentry's client SDK was silently initializing
  // with `enabled: false` everywhere, since process.env.VERCEL_ENV was
  // simply undefined in the browser bundle. This `env` field (per
  // Next.js's own docs — node_modules/next/dist/docs/.../config/env.md)
  // is the documented way to explicitly whitelist a specific value for
  // client-bundle inclusion regardless of its name.
  env: {
    VERCEL_ENV: process.env.VERCEL_ENV,
  },
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
// used here — disableLogger was tried and dropped: the build itself
// warns it's deprecated *and* "not supported with Turbopack," so it
// was dead weight, not a real setting. No org/project/authToken set:
// without them the plugin skips source-map upload gracefully (readable
// stack traces in the Sentry dashboard are a real follow-up once
// there's a Sentry auth token to configure, not required for error
// capture itself to work) — see docs/ROADMAP.md NK-06's note on this.
//
// The build also warns about an `onRouterTransitionStart` hook Sentry
// expects for route-change *tracing* — deliberately not added, since
// this design explicitly excludes performance monitoring/APM (see the
// design doc's "no tracing" decision). Expected noise, not an
// unaddressed action item.
export default withSentryConfig(withSerwist(nextConfig), {
  silent: true,
  widenClientFileUpload: false,
});
