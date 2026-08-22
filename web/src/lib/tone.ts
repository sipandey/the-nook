/**
 * Client-safe tone types/options — deliberately separate from
 * src/lib/ai/openai.ts (which is `import "server-only"` and would break if
 * a client component imported it just for this union type).
 *
 * Stored in Clerk's per-user unsafeMetadata (see useTone.ts) rather than a
 * new Supabase column: tone is a UI preference, not sensitive content, so
 * it doesn't need the encryption model at all, and Clerk already owns "the
 * user's account-level settings."
 */
export type Tone = "coach" | "friend" | "mirror" | "minimal";

export const DEFAULT_TONE: Tone = "friend";

export const TONE_OPTIONS: { key: Tone; name: string; description: string }[] = [
  { key: "coach", name: "Coach", description: "Direct, motivating, calls out progress." },
  { key: "friend", name: "Friend", description: "Warm, casual, checks in like a friend." },
  { key: "mirror", name: "Mirror", description: "Neutral, reflects patterns without opinion." },
  { key: "minimal", name: "Minimal", description: "Just the facts and trends." },
];
