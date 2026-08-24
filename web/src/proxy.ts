/**
 * Auth gate for the app. Named `proxy.ts`, not `middleware.ts` — Next.js 16
 * renamed the file convention (middleware.js is deprecated; see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 * Clerk's `clerkMiddleware` still works here; it just needs to be the
 * default export of this renamed file.
 */

import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sso-callback(.*)",
  "/api/webhooks(.*)",
]);

// Dev-only visual QA bypass — see src/lib/preview.ts for the full picture.
// Guarded the same way there: requires the explicit opt-in env var AND
// that this isn't a real Vercel deployment, so it can't silently activate
// on a hosted build even if the env var leaked into one.
const PREVIEW_MODE =
  !process.env.VERCEL_ENV && process.env.NEXT_PUBLIC_PREVIEW_MODE === "1";

// Clerk's publishable-key prefix (pk_live_ vs pk_test_) is the stable,
// public signal for "which kind of instance is this" — used here instead
// of an internal/undocumented SDK helper. See the frontendApiProxy note
// below for why this matters: the proxy should only be active for a
// production instance, not local dev's pk_test_ key.
const IS_PRODUCTION_CLERK = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").startsWith(
  "pk_live_",
);

/**
 * clerkMiddleware() itself — not just an unguarded auth.protect() call
 * inside it — performs a dev-instance "browser handshake" redirect to
 * accounts.dev for any request it doesn't recognize, before any custom
 * callback logic runs. Skipping auth.protect() alone doesn't avoid that;
 * preview mode has to bypass clerkMiddleware() entirely.
 *
 * frontendApiProxy: production Clerk routes its Frontend API through this
 * app's own domain at /__clerk (see the matching ClerkProvider proxyUrl
 * in src/app/layout.tsx) instead of a dedicated clerk.* subdomain — no
 * DNS changes needed on Vercel. @clerk/nextjs (7.x) *can* auto-detect this
 * from Vercel's own env vars, but only client-side and only when
 * VERCEL_TARGET_ENV === "production" — Preview deployments with live keys
 * would silently miss it. Set explicitly here so both Production and
 * Preview behave the same way, not dependent on that env-var nuance.
 * Gated on IS_PRODUCTION_CLERK so local dev's pk_test_ key keeps talking
 * to Clerk directly, unchanged. Requests to /__clerk/* are handled
 * entirely inside clerkMiddleware() before the callback below ever runs,
 * so this doesn't interact with isPublicRoute/auth.protect() at all.
 *
 * signInUrl/signUpUrl: without these, auth.protect()'s redirect for an
 * unauthenticated visitor falls back to Clerk's hosted Account Portal
 * instead of this app's own /sign-in and /sign-up pages (built custom —
 * see those routes; this app never used Clerk's hosted UI). On the
 * production instance that fallback surfaced as a redirect to
 * accounts.<old-vercel-project>.vercel.app, not creator-ai.in — set
 * explicitly, as plain paths (not full URLs), so the redirect always
 * stays on whatever domain the request actually came in on.
 */
export default PREVIEW_MODE
  ? () => NextResponse.next()
  : clerkMiddleware(
      async (auth, req) => {
        if (!isPublicRoute(req)) {
          await auth.protect();
        }
      },
      {
        signInUrl: "/sign-in",
        signUpUrl: "/sign-up",
        ...(IS_PRODUCTION_CLERK ? { frontendApiProxy: { enabled: true } } : {}),
      },
    );

export const config = {
  matcher: [
    // Skip Next.js internals and static assets, always run for API routes.
    "/((?!_next|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
