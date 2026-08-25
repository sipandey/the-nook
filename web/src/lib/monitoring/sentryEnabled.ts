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
