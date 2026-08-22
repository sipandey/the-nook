/**
 * Auth gate for the app. Named `proxy.ts`, not `middleware.ts` — Next.js 16
 * renamed the file convention (middleware.js is deprecated; see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 * Clerk's `clerkMiddleware` still works here; it just needs to be the
 * default export of this renamed file.
 */

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sso-callback(.*)",
  "/api/webhooks(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
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
