"use client";

import ReactDOM from "react-dom";

/**
 * Preemptively opens a connection to Clerk's Frontend API origin before
 * Clerk's own async <script> tag needs it — see the comment on this
 * component's usage in layout.tsx for why. Uses React's dedicated
 * `ReactDOM.preconnect` API (not a plain `<link rel="preconnect">`
 * element): a plain element was tried first and, despite rendering
 * correctly, landed *after* Clerk's own script tag in the actual SSR
 * HTML output — confirmed by inspecting the build directly. Per Next.js's
 * own docs (generate-metadata.md's "Resource hints" section), this
 * dedicated API is what next/font and next/script use internally for
 * correct head-priority placement; a bare declarative <link> doesn't get
 * the same treatment. Still fully SSR'd on initial load despite requiring
 * a Client Component to call it.
 */
export function ClerkPreconnect() {
  ReactDOM.preconnect("https://clerk.creator-ai.in", { crossOrigin: "anonymous" });
  return null;
}
