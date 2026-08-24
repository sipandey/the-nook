/**
 * Serves the bundled service worker (sw.js, sw.js.map) — see
 * docs/ROADMAP.md NK-07 and src/app/sw.ts. `createSerwistRoute` builds
 * this at request time in dev and statically at build time in production
 * (generateStaticParams enumerates the output files; dynamic = "force-static").
 */

import { createSerwistRoute } from "@serwist/turbopack";
import { spawnSync } from "node:child_process";

// A build-time revision for the one manually-added precache entry below
// (everything else is revisioned by content hash automatically). Using
// the git commit matches Serwist's own recommended default — this repo
// is always built from a git checkout, including on Vercel.
const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ??
  crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
});
