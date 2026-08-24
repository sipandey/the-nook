"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { BottomTabBar } from "@/components/BottomTabBar";
import { MaterialIcon } from "@/components/MaterialIcon";
import { useEntries } from "@/lib/hooks/useEntries";
import { useDecryptedEntries } from "@/lib/hooks/useDecryptedEntries";
import { useSessionStore } from "@/lib/store/session";

const MOOD_LABEL: Record<number, string> = {
  1: "Struggling",
  2: "Low",
  3: "Steady",
  4: "Good",
  5: "Great",
};

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

  const hasAnyEntries = (entries ?? []).length > 0;

  return (
    <div className="font-editorial-sans mx-auto flex min-h-screen w-full max-w-md flex-col bg-background text-on-background pb-24">
      <AppHeader />

      <main className="flex-grow px-container-padding pt-2 max-w-3xl mx-auto w-full">
        {!isLoading && !hasAnyEntries ? (
          <div className="flex-grow flex flex-col items-center justify-center pt-16 gap-stack-gap text-center">
            <div className="w-40 h-40 rounded-full bg-surface-container flex items-center justify-center">
              <MaterialIcon name="menu_book" size={48} className="text-outline-variant" />
            </div>
            <div className="flex flex-col items-center gap-2 max-w-[280px]">
              <h2 className="font-editorial-display text-headline-md text-on-background">No thoughts captured yet</h2>
              <p className="text-body-lg text-outline">
                Your mind is a blank canvas. Take a deep breath and start your first reflection.
              </p>
            </div>
            <Link
              href="/write"
              className="bg-primary text-on-primary text-label-sm px-8 py-4 rounded-full flex items-center gap-2 hover:bg-surface-tint active:scale-95 transition-all shadow-[0_4px_14px_0_rgba(74,101,78,0.15)]"
            >
              <MaterialIcon name="edit_document" size={18} />
              Start your first entry
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-stack-gap">
              <div className="relative flex items-center w-full h-12 rounded-full bg-surface-container-low border border-outline-variant/30 focus-within:border-primary/50 focus-within:bg-surface transition-colors overflow-hidden">
                <div className="grid place-items-center h-full w-12 text-outline">
                  <MaterialIcon name="search" size={20} />
                </div>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your entries…"
                  className="peer h-full w-full outline-none text-body-md text-on-surface bg-transparent pr-4 placeholder:text-outline-variant"
                />
              </div>
              <Link
                href="/search"
                className="mt-2 inline-flex items-center gap-1 text-label-sm text-primary hover:text-surface-tint transition-colors"
              >
                <MaterialIcon name="travel_explore" size={14} />
                Try Smart Search — find entries by meaning
              </Link>
            </div>

            {isLoading && <p className="text-sm text-on-surface-variant">Loading…</p>}

            {!isLoading && filtered.length === 0 && (
              <div className="flex flex-col items-center gap-2 pt-8 text-center">
                <MaterialIcon name="search_off" size={28} className="text-outline mb-1" />
                <h2 className="font-editorial-display text-headline-md text-on-background">No matches</h2>
                <p className="text-body-md text-on-surface-variant">
                  Nothing matches &ldquo;{query}&rdquo;. Try a different word or tag.
                </p>
              </div>
            )}

            {groups.map(([month, monthEntries]) => (
              <section key={month} className="mb-stack-gap">
                <h2 className="font-editorial-display text-headline-md text-primary mb-inline-gap border-b border-surface-container-highest pb-2">
                  {month}
                </h2>
                <div className="flex flex-col gap-inline-gap">
                  {monthEntries.map((entry) => {
                    const date = new Date(entry.created_at);
                    const snippet = decrypted[entry.id];
                    const moodLabel = entry.mood_score ? MOOD_LABEL[entry.mood_score] : null;
                    return (
                      <Link
                        key={entry.id}
                        href={`/journal/${entry.id}`}
                        className="block p-6 rounded-xl bg-surface-container-low border border-transparent transition-all hover:shadow-[0_4px_20px_-4px_rgba(74,101,78,0.1)] hover:border-surface-variant"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <time className="text-label-sm text-outline">
                            {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </time>
                          {moodLabel && (
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-surface-container-high text-primary text-[11px] tracking-wider uppercase">
                              {moodLabel}
                            </span>
                          )}
                        </div>
                        <p className="text-body-lg text-on-surface-variant line-clamp-3 leading-relaxed">
                          {snippet === undefined ? "…" : snippet || "(couldn't decrypt this entry)"}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}

            <div className="flex justify-center items-center gap-2 mt-stack-gap text-outline opacity-60">
              <MaterialIcon name="lock" size={16} />
              <span className="text-label-sm">End-to-End Encrypted</span>
            </div>
          </>
        )}
      </main>

      <BottomTabBar />
    </div>
  );
}
