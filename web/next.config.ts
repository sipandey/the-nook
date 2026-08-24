import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  /* config options here */
};

// @serwist/next (the webpack-based Serwist integration) silently no-ops
// under Turbopack, which this app uses for both `next dev` and `next
// build` — @serwist/turbopack is the maintainer-recommended alternative
// for exactly that case. See docs/ROADMAP.md NK-07 and src/app/sw.ts.
export default withSerwist(nextConfig);
