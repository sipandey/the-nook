import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * "node" environment, not "jsdom" — everything under test so far is a pure
 * TS module (src/lib/crypto/), not a component, and Node 22's global
 * WebCrypto (crypto.subtle) plus btoa/atob cover what it needs without
 * pulling in a DOM shim. Add a jsdom project/config separately if/when a
 * component test needs one, rather than paying for it here.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
