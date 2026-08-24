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
  // Marketing/legal pages — no journal content, no reason to require a
  // session. See src/components/PublicPageChrome.tsx.
  "/about",
  "/encryption",
  "/privacy",
  "/delete-my-data",
  // PWA/service-worker plumbing (see docs/ROADMAP.md NK-07) — must stay
  // reachable pre-auth: SerwistProvider registers the SW from the root
  // layout, so it mounts on public pages too (sign-in, about, etc.), and
  // the SW's install-time precache fetch for /~offline happens without
  // Clerk session context. Gating either behind auth.protect() would mean
  // an unauthenticated visitor can't register a service worker at all,
  // and the cached "offline" fallback would silently become a cached
  // sign-in redirect instead of the real offline page.
  "/serwist(.*)",
  "/~offline",
]);

// Dev-only visual QA bypass — see src/lib/preview.ts for the full picture.
// Guarded the same way there: requires the explicit opt-in env var AND
// that this isn't a real Vercel deployment, so it can't silently activate
// on a hosted build even if the env var leaked into one.
const PREVIEW_MODE =
  !process.env.VERCEL_ENV && process.env.NEXT_PUBLIC_PREVIEW_MODE === "1";

/**
 * clerkMiddleware() itself — not just an unguarded auth.protect() call
 * inside it — performs a dev-instance "browser handshake" redirect to
 * accounts.dev for any request it doesn't recognize, before any custom
 * callback logic runs. Skipping auth.protect() alone doesn't avoid that;
 * preview mode has to bypass clerkMiddleware() entirely.
 *
 * No frontendApiProxy/proxyUrl here — deliberately. An earlier version of
 * this file routed Clerk's Frontend API through this app's own /__clerk
 * path, based on a Clerk dashboard checklist step that turned out to
 * describe an in-progress, pre-migration state. Once the production
 * domain migration to creator-ai.in actually completed, Clerk issued a
 * publishable key scoped to the dedicated clerk.creator-ai.in subdomain
 * (verified by decoding the key: pk_live_… base64-decodes to
 * "clerk.creator-ai.in$") — the DNS-CNAME method (clerk, clk._domainkey,
 * clk2._domainkey, clkmail records), not the app-proxy method. Keeping
 * the /__clerk proxy code active after that point actively broke auth:
 * it forced requests through this app's own middleware instead of
 * letting them reach clerk.creator-ai.in directly, where they're
 * correctly attributed. See .agent-room/anti-patterns.md.
 *
 * signInUrl/signUpUrl: without these, auth.protect()'s redirect for an
 * unauthenticated visitor falls back to Clerk's hosted Account Portal
 * instead of this app's own /sign-in and /sign-up pages (built custom —
 * see those routes; this app never used Clerk's hosted UI). Set
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
      { signInUrl: "/sign-in", signUpUrl: "/sign-up" },
    );

export const config = {
  matcher: [
    // Skip Next.js internals and static assets, always run for API routes.
    "/((?!_next|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
    "/(api|trpc)(.*)",
  ],
};
