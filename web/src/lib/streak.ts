/**
 * Consecutive-day streak from entry timestamps. Pure function, no I/O, so
 * it's cheap to unit test and safe to run client-side against already
 * fetched entry metadata (mood/tags/created_at are unencrypted — see
 * docs/ARCHITECTURE.md §4 — so this needs no DEK).
 */

function toDateKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10); // YYYY-MM-DD, UTC
}

/**
 * Counts back from today (or yesterday, if nothing is logged yet today —
 * writing later today shouldn't have already broken the streak) through
 * consecutive calendar days that have at least one entry.
 */
export function computeStreak(entryTimestamps: string[]): number {
  if (entryTimestamps.length === 0) return 0;

  const daysWithEntries = new Set(entryTimestamps.map(toDateKey));

  const cursor = new Date();
  const todayKey = toDateKey(cursor.toISOString());
  if (!daysWithEntries.has(todayKey)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  let streak = 0;
  while (daysWithEntries.has(toDateKey(cursor.toISOString()))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}
