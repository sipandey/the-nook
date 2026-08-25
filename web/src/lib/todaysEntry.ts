import type { EntryMetadata } from "@/lib/hooks/useEntries";

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * The entry to append to when opening the composer without an explicit
 * ?entryId= — see docs/plans/2026-08-24-append-to-todays-entry-design.md.
 * "Today" is the device's local calendar day, matching the existing
 * "one year ago today" comparison in journal/[id]/page.tsx. If more than
 * one entry happens to exist for today (e.g. from before this feature
 * shipped), the most recently *created* one wins — arbitrary but
 * deterministic, and not a case new entries can produce going forward.
 */
export function getTodaysEntry(entries: EntryMetadata[]): EntryMetadata | undefined {
  const now = new Date();
  const todays = entries.filter((e) => isSameLocalDay(new Date(e.created_at), now));
  if (todays.length === 0) return undefined;
  return todays.reduce((latest, e) =>
    new Date(e.created_at) > new Date(latest.created_at) ? e : latest,
  );
}
