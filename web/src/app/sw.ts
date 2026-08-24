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

/**
 * Push notification handling — see docs/ROADMAP.md NK-09. Not part of
 * Serwist's own event set (it only wires up caching-related events), so
 * these are plain, hand-rolled `push`/`notificationclick` listeners.
 *
 * Payload contract for whoever sends a push (NK-10's cron job):
 * `{ title: string, body: string, url?: string }`, JSON-encoded. `title`
 * and `body` must already be the generic, non-content-revealing text
 * decided in NK-08 (docs/ARCHITECTURE.md §8) — this handler renders
 * whatever it's given verbatim, so getting that right is the sender's
 * responsibility, not something enforced here. `url` is where a tap
 * should land (e.g. "/playback" for a playback-ready push); defaults to
 * "/".
 */
self.addEventListener("push", (event) => {
  let payload: { title?: string; body?: string; url?: string } = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    // A push with a malformed/missing payload shouldn't throw and drop
    // the notification silently — fall back to a bare, still-generic title.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "The Nook", {
      body: payload.body ?? "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url: string = event.notification.data?.url ?? "/";
  const targetUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url === targetUrl);
      if (existing) return existing.focus();
      return self.clients.openWindow(targetUrl);
    }),
  );
});
