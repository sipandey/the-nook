/**
 * NK-12 (docs/ROADMAP.md) — a bound on how much plaintext one entry can
 * contain, so per-call OpenAI cost in playback generation and
 * manifestation-signal detection stays predictable. ~2,000 words /
 * several pages — generous enough that no real journal entry should
 * ever hit it, while still bounding worst case.
 *
 * The composer enforces this as a hard `maxLength` on save (the primary
 * enforcement — see src/app/(app)/write/page.tsx), so entries stored
 * this way are already within the limit by construction. This module's
 * `truncateToEntryLimit` is the server-side safety net where it
 * actually matters for cost: src/app/api/ai/{playback,detect-signals}/route.ts,
 * the two routes that receive real plaintext (transiently, per
 * docs/ARCHITECTURE.md §6.4/§6.5) and call OpenAI with it. The entries
 * storage routes themselves never see plaintext at all — this app
 * encrypts client-side — so enforcing a character cap there isn't
 * architecturally possible in any meaningful way; this is why the cap
 * lives at the AI call sites instead.
 */
export const ENTRY_MAX_LENGTH = 10_000;

/** Truncates from the end, keeping the beginning of the text — the part
 *  a user wrote first is more likely to carry the entry's actual point
 *  than whatever trailed off past 10,000 characters. */
export function truncateToEntryLimit(text: string): string {
  return text.length > ENTRY_MAX_LENGTH ? text.slice(0, ENTRY_MAX_LENGTH) : text;
}
