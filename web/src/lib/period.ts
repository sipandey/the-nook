import type { EntryMetadata } from "@/lib/hooks/useEntries";

export type Period = "week" | "month" | "year";

export function periodRange(period: Period, now = new Date()): { start: Date; end: Date } {
  const end = now;
  const start = new Date(now);
  if (period === "week") start.setDate(start.getDate() - 7);
  if (period === "month") start.setMonth(start.getMonth() - 1);
  if (period === "year") start.setFullYear(start.getFullYear() - 1);
  return { start, end };
}

export function entriesInRange(entries: EntryMetadata[], start: Date, end: Date): EntryMetadata[] {
  return entries
    .filter((e) => {
      const d = new Date(e.created_at);
      return d >= start && d <= end;
    })
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export type MoodDirection = "rising" | "falling" | "steady" | "unknown";

/** Compares the average mood of the first half of the period against the
 *  second half — a simple, honest trend signal rather than anything
 *  AI-guessed, since mood_score is already real numeric data. */
export function moodDirection(entries: EntryMetadata[]): MoodDirection {
  const scored = entries.filter((e): e is EntryMetadata & { mood_score: number } =>
    e.mood_score != null,
  );
  if (scored.length < 2) return "unknown";

  const mid = Math.floor(scored.length / 2);
  const firstHalf = scored.slice(0, mid || 1);
  const secondHalf = scored.slice(mid || 1);
  const avg = (list: typeof scored) => list.reduce((s, e) => s + e.mood_score, 0) / list.length;

  const delta = avg(secondHalf) - avg(firstHalf);
  if (delta > 0.4) return "rising";
  if (delta < -0.4) return "falling";
  return "steady";
}

export function topTag(entries: EntryMetadata[]): string | null {
  const counts = new Map<string, number>();
  for (const e of entries) {
    for (const tag of e.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [tag, count] of counts) {
    if (count > bestCount) {
      best = tag;
      bestCount = count;
    }
  }
  return best;
}

const MIN_COMPARISON_GAP_DAYS = 45;

/**
 * Looks for a genuine "then vs now" pair: a recent entry and an older one
 * (at least ~45 days apart) that share a tag, so the comparison is about
 * the same kind of topic rather than two random days. Returns null if no
 * such pair exists yet — a brand-new account has no history to compare
 * against, and the playback story sequence should just skip that card
 * rather than fabricate one.
 */
export function findComparisonPair(
  allEntries: EntryMetadata[],
  periodEntries: EntryMetadata[],
): { now: EntryMetadata; then: EntryMetadata } | null {
  const now = [...periodEntries].reverse().find((e) => e.tags.length > 0);
  if (!now) return null;

  const nowDate = new Date(now.created_at);
  const cutoff = new Date(nowDate);
  cutoff.setDate(cutoff.getDate() - MIN_COMPARISON_GAP_DAYS);

  const candidates = allEntries
    .filter((e) => e.id !== now.id && new Date(e.created_at) <= cutoff)
    .filter((e) => e.tags.some((t) => now.tags.includes(t)))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const then = candidates[0];
  return then ? { now, then } : null;
}
