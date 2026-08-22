"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HillsHero } from "@/components/HillsHero";
import { BottomTabBar } from "@/components/BottomTabBar";
import { useEntries } from "@/lib/hooks/useEntries";
import { periodRange, entriesInRange, moodDirection, topTag, type Period } from "@/lib/period";

const PERIODS: { key: Period; label: string }[] = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

const DIRECTION_LABEL: Record<string, string> = {
  rising: "Rising",
  falling: "Dipping",
  steady: "Steady",
  unknown: "Not enough data",
};

export default function PlaybackPage() {
  const router = useRouter();
  const { data: entries, isLoading } = useEntries();
  const [selected, setSelected] = useState<Period>("week");

  const periodEntries = useMemo(() => {
    if (!entries) return [];
    const { start, end } = periodRange(selected);
    return entriesInRange(entries, start, end);
  }, [entries, selected]);

  const stats = useMemo(
    () => ({
      count: periodEntries.length,
      direction: moodDirection(periodEntries),
      tag: topTag(periodEntries),
    }),
    [periodEntries],
  );

  const otherPeriods = useMemo(() => {
    if (!entries) return [];
    return PERIODS.filter((p) => p.key !== selected).map((p) => {
      const { start, end } = periodRange(p.key);
      const list = entriesInRange(entries, start, end);
      return { ...p, count: list.length };
    });
  }, [entries, selected]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <HillsHero height={52} sunSide="left" />
      <div className="flex flex-shrink-0 flex-col gap-3 px-4 pt-4 pb-2">
        <h1 className="text-[17px] font-bold">Playback</h1>
        <div className="flex rounded-[9px] border-[1.3px] border-border overflow-hidden">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setSelected(p.key)}
              className={`flex-1 py-2 text-xs font-semibold ${
                selected === p.key ? "bg-accent text-white" : "text-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <main className="flex flex-1 flex-col gap-3 px-4 pb-3">
        {isLoading && <p className="text-xs text-muted">Loading…</p>}

        {!isLoading && (
          <div className="rounded-xl border border-border bg-accent-soft/40 p-4">
            <div className="text-[10px] uppercase tracking-wide text-muted">
              {selected === "week" ? "Last 7 days" : selected === "month" ? "Last 30 days" : "Last 12 months"}
            </div>
            <div className="mt-1.5 text-base font-bold">
              Your {selected} in review
            </div>
            <div className="mt-3 flex gap-4">
              <div>
                <div className="text-[10px] text-muted">Entries</div>
                <div className="text-sm font-bold">{stats.count}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted">Mood</div>
                <div className="text-sm font-bold">{DIRECTION_LABEL[stats.direction]}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted">Top theme</div>
                <div className="text-sm font-bold">{stats.tag ?? "—"}</div>
              </div>
            </div>

            {stats.count > 0 ? (
              <button
                type="button"
                onClick={() => router.push(`/playback/story?period=${selected}`)}
                className="mt-3.5 flex w-full items-center justify-center gap-1.5 rounded-[9px] bg-accent px-3 py-2.5 text-xs font-semibold text-white"
              >
                <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="10" cy="10" r="7.5" />
                  <path d="M8.5 7.2 13 10l-4.5 2.8V7.2z" />
                </svg>
                Watch recap
              </button>
            ) : (
              <p className="mt-3.5 text-[11px] text-muted">
                Write a few entries this {selected} to unlock a recap.
              </p>
            )}
          </div>
        )}

        {!isLoading && otherPeriods.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="text-[11px] uppercase tracking-wide text-faint">Also see</div>
            {otherPeriods.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setSelected(p.key)}
                className="flex items-center justify-between rounded-[10px] border-[1.2px] border-border bg-surface px-3.5 py-2.5 text-left"
              >
                <span className="text-xs font-semibold">Your {p.label.toLowerCase()}</span>
                <span className="text-[11px] text-faint">{p.count} entries</span>
              </button>
            ))}
          </div>
        )}
      </main>

      <BottomTabBar />
    </div>
  );
}
