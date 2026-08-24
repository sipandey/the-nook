import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // supabase/.gitignore already excludes this from git, but ESLint has
    // its own ignore list and doesn't read a nested .gitignore — without
    // this, running `supabase start` locally (see docs/ROADMAP.md NK-03)
    // drops vendored, minified Edge Runtime JS into supabase/.temp/ that
    // then gets linted as if it were real source.
    "supabase/.temp/**",
  ]),
]);

export default eslintConfig;
