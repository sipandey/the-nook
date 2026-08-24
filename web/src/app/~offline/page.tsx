"use client";

import { MaterialIcon } from "@/components/MaterialIcon";

/**
 * Served by the service worker (src/app/sw.ts's `fallbacks.entries`) when
 * a page navigation fails while offline — never reached via a normal
 * link, only ever shown in place of whatever page was actually requested.
 * Public route — see src/proxy.ts's note on why.
 */
export default function OfflinePage() {
  return (
    <div className="font-editorial-sans bg-background text-on-background min-h-dvh flex flex-col items-center justify-center px-container-padding text-center antialiased">
      <MaterialIcon name="cloud_off" size={40} className="text-outline mb-4" />
      <h1 className="font-editorial-display text-headline-md text-primary mb-2">
        You&rsquo;re offline
      </h1>
      <p className="text-body-md text-on-surface-variant max-w-xs mb-6">
        This page needs a connection we can&rsquo;t reach right now. Anything you&rsquo;d already
        opened stays available — try again once you&rsquo;re back online.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="text-label-sm text-primary border border-primary/40 rounded-full px-5 py-2 hover:bg-primary-container hover:text-on-primary-container transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
