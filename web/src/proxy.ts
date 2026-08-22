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

/**
 * clerkMiddleware() itself — not just an unguarded auth.protect() call
 * inside it — performs a dev-instance "browser handshake" redirect to
 * accounts.dev for any request it doesn't recognize, before any custom
 * callback logic runs. Skipping auth.protect() alone doesn't avoid that;
 * preview mode has to bypass clerkMiddleware() entirely.
 */
export default PREVIEW_MODE
  ? () => NextResponse.next()
  : clerkMiddleware(async (auth, req) => {
      if (!isPublicRoute(req)) {
        await auth.protect();
      }
    });

export const config = {
  matcher: [
    // Skip Next.js internals and static assets, always run for API routes.
    "/((?!_next|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
    "/(api|trpc)(.*)",
  ],
};
