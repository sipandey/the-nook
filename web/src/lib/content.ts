import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Reads a public-page's Markdown source from web/content/. Server-only —
 * these are Server Components (no "use client"), so a direct filesystem
 * read at request/build time is the simplest way to load it; no API
 * route or client fetch needed. See src/components/MarkdownContent.tsx
 * for how the source gets rendered.
 *
 * Deliberately one function per file with a literal path, not a single
 * `readContent(slug)` taking a variable — Vercel's serverless bundling
 * relies on static file-tracing to know which files a function needs,
 * and a dynamically-interpolated path (`${slug}.md`) isn't reliably
 * traceable, which could mean content/*.md silently isn't included in
 * the deployed function even though it works fine locally. A literal
 * `join(process.cwd(), "content", "about.md")` per call site is the
 * well-documented safe pattern.
 */
const CONTENT_DIR = join(process.cwd(), "content");

export function readAboutContent(): string {
  return readFileSync(join(CONTENT_DIR, "about.md"), "utf-8");
}

export function readEncryptionContent(): string {
  return readFileSync(join(CONTENT_DIR, "encryption.md"), "utf-8");
}

export function readPrivacyContent(): string {
  return readFileSync(join(CONTENT_DIR, "privacy.md"), "utf-8");
}

export function readDeleteMyDataContent(): string {
  return readFileSync(join(CONTENT_DIR, "delete-my-data.md"), "utf-8");
}
