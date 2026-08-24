/**
 * Service worker source — bundled and served by
 * src/app/serwist/[path]/route.ts, registered by SerwistProvider in
 * src/app/providers.tsx. See docs/ROADMAP.md NK-07.
 *
 * `defaultCache` (from @serwist/turbopack/worker) is Serwist's recommended
 * runtime-caching strategy set for a Next.js app — stale-while-revalidate
 * for pages/RSC payloads, cache-first for static assets/fonts/images,
 * network-first for API-shaped requests. Nothing custom here yet: this is
 * app-shell caching (NK-07/NK-11), not a hand-tuned per-route cache
 * policy, and defaultCache is the right starting point for that.
 *
 * The offline fallback only ever applies to document (page) navigations —
 * a failed fetch for an API route or an asset isn't shown this page, it
 * just fails, which is the correct behavior (this is not an offline-first
 * app; see docs/ARCHITECTURE.md — entries still need a live connection to
 * save).
 */

import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
