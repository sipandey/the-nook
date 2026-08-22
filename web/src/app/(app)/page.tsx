"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { HillsHero } from "@/components/HillsHero";
import { BottomTabBar } from "@/components/BottomTabBar";
import { MoodDots } from "@/components/MoodDots";
import { useEntries } from "@/lib/hooks/useEntries";
import { useDecryptedEntries } from "@/lib/hooks/useDecryptedEntries";
import { computeStreak } from "@/lib/streak";
import { useSessionStore } from "@/lib/store/session";
import { useTone } from "@/lib/hooks/useTone";
import type { Tone } from "@/lib/tone";

function useDailyPrompt(tone: Tone) {
  return useQuery({
    queryKey: ["ai", "prompt", tone, new Date().toISOString().slice(0, 10)],
    queryFn: async (): Promise<{ prompt: string; tone: string }> => {
      const res = await fetch(`/api/ai/prompt?tone=${tone}`);
      if (!res.ok) throw new Error("Failed to load prompt");
      return res.json();
    },
    staleTime: Infinity,
  });
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short" });
}

export default function Home() {
  const { user } = useUser();
  const { tone } = useTone();
  const { data: entries, isLoading: entriesLoading } = useEntries();
  const { data: promptData, isLoading: promptLoading } = useDailyPrompt(tone);
  const dek = useSessionStore((s) => s.dek);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);

  const streak = useMemo(
    () => computeStreak((entries ?? []).map((e) => e.created_at)),
    [entries],
  );

  const recentEntries = useMemo(() => (entries ?? []).slice(0, 3), [entries]);
  const snippets = useDecryptedEntries(recentEntries, dek);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const today = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    [],
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <HillsHero height={108} sunSide="right" />

      <main className="flex flex-1 flex-col gap-3.5 px-4 pt-4 pb-3">
        <div>
          <h1 className="text-[19px] font-semibold">
            {greeting}
            {user?.firstName ? `, ${user.firstName}` : ""}
          </h1>
          <p className="mt-0.5 text-xs text-muted">{today}</p>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-accent">
            <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M10 2.5c1 3 4 4 4 8a4 4 0 0 1-8 0c0-1.5.8-2.3 1.5-3 0 1.2.7 1.8 1.3 1.8 0-3 .3-5 1.2-6.8z" />
            </svg>
            {entriesLoading ? "…" : `${streak} day streak`}
          </div>
        </div>

        <div className="rounded-[10px] border border-border bg-surface p-3.5">
          <div className="mb-1.5 text-[10px] uppercase tracking-wide text-faint">
            Today&rsquo;s prompt
          </div>
          <p className="text-sm italic leading-snug">
            {promptLoading ? "Thinking of something to ask you…" : `"${promptData?.prompt}"`}
          </p>

          <div className="mt-2.5">
            <MoodDots value={selectedMood} onChange={setSelectedMood} />
          </div>
          <div className="mt-1 flex justify-between text-[9px] text-faint">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>

        <div className="flex gap-2.5">
          <Link
            href={selectedMood ? `/write?mood=${selectedMood}` : "/write"}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border-[1.3px] border-accent bg-accent px-3 py-3 text-[13px] font-semibold text-white"
          >
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M12.5 3.5l4 4L6 18H2v-4L12.5 3.5z" />
            </svg>
            New entry
          </Link>
          <Link
            href="/write?mode=voice"
            aria-label="Record a voice entry"
            className="flex w-11 items-center justify-center rounded-[10px] border-[1.3px] border-border bg-surface"
          >
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="7.5" y="2.5" width="5" height="9" rx="2.5" />
              <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0" />
              <path d="M10 15v2.5" />
            </svg>
          </Link>
        </div>

        <div className="mt-1 text-[11px] uppercase tracking-wide text-faint">
          Recent entries
        </div>
        <div>
          {entriesLoading && <p className="text-xs text-muted">Loading…</p>}

          {!entriesLoading && recentEntries.length === 0 && (
            <p className="text-xs text-muted">
              Nothing yet — your first entry will show up here.
            </p>
          )}

          {recentEntries.map((entry) => {
            const snippet = snippets[entry.id];
            return (
              <Link
                key={entry.id}
                href={`/journal/${entry.id}`}
                className="flex items-center gap-2.5 border-b border-divider py-2.5"
              >
                <span
                  className="h-[9px] w-[9px] flex-shrink-0 rounded-full"
                  style={{
                    background:
                      entry.mood_score && entry.mood_score >= 3 ? "#4f6b52" : "#c9c2ab",
                  }}
                />
                <span className="w-11 flex-shrink-0 text-[10px] text-faint">
                  {formatDay(entry.created_at)}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs">
                  {snippet === undefined ? "…" : snippet || "(couldn't decrypt this entry)"}
                </span>
              </Link>
            );
          })}
        </div>
      </main>

      <BottomTabBar />
    </div>
  );
}
