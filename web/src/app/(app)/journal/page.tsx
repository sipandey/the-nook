"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { HillsHero } from "@/components/HillsHero";
import { BottomTabBar } from "@/components/BottomTabBar";
import { useEntries } from "@/lib/hooks/useEntries";
import { useDecryptedEntries } from "@/lib/hooks/useDecryptedEntries";
import { useSessionStore } from "@/lib/store/session";

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function JournalPage() {
  const { data: entries, isLoading } = useEntries();
  const dek = useSessionStore((s) => s.dek);
  const decrypted = useDecryptedEntries(entries, dek);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const all = entries ?? [];
    if (!query.trim()) return all;
    const q = query.trim().toLowerCase();
    return all.filter((e) => {
      const text = decrypted[e.id]?.toLowerCase() ?? "";
      const tags = e.tags.join(" ").toLowerCase();
      return text.includes(q) || tags.includes(q);
    });
  }, [entries, decrypted, query]);

  const groups = useMemo(() => {
    const byMonth = new Map<string, typeof filtered>();
    for (const entry of filtered) {
      const key = monthLabel(entry.created_at);
      const list = byMonth.get(key) ?? [];
      list.push(entry);
      byMonth.set(key, list);
    }
    return Array.from(byMonth.entries());
  }, [filtered]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <HillsHero height={52} sunSide="right" />

      <div className="flex flex-shrink-0 flex-col gap-2.5 px-4 pt-3 pb-2">
        <h1 className="text-[17px] font-bold">Journal</h1>
        <div className="flex items-center gap-2 rounded-full border-[1.2px] border-border bg-surface px-3 py-1.5">
          <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-faint">
            <circle cx="9" cy="9" r="6" />
            <path d="M13.5 13.5L18 18" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search entries or tags"
            className="w-full border-none bg-transparent text-xs outline-none placeholder:text-faint"
          />
        </div>
      </div>

      <main className="flex-1 px-4 pb-3">
        {isLoading && <p className="pt-2 text-xs text-muted">Loading…</p>}

        {!isLoading && filtered.length === 0 && (
          <p className="pt-2 text-xs text-muted">
            {query ? "No entries match that search." : "Nothing here yet."}
          </p>
        )}

        {groups.map(([month, monthEntries]) => (
          <div key={month}>
            <div className="mt-2.5 mb-1.5 text-[11px] uppercase tracking-wide text-faint">
              {month}
            </div>
            {monthEntries.map((entry) => {
              const date = new Date(entry.created_at);
              const snippet = decrypted[entry.id];
              return (
                <Link
                  key={entry.id}
                  href={`/journal/${entry.id}`}
                  className="flex items-center gap-3 border-b border-divider py-2.5"
                >
                  <div className="w-9 flex-shrink-0 text-center">
                    <div className="text-[15px] font-bold leading-none">{date.getDate()}</div>
                    <div className="mt-0.5 text-[9px] text-faint">
                      {date.toLocaleDateString(undefined, { weekday: "short" })}
                    </div>
                  </div>
                  <span
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{
                      background:
                        entry.mood_score && entry.mood_score >= 3 ? "#4f6b52" : "#c9c2ab",
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs">
                    {snippet === undefined ? "…" : snippet || "(couldn't decrypt this entry)"}
                  </span>
                  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" className="flex-shrink-0 text-faint">
                    <path d="M7.5 4.5L13.5 10l-6 5.5" />
                  </svg>
                </Link>
              );
            })}
          </div>
        ))}
      </main>

      <BottomTabBar />
    </div>
  );
}
