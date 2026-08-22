"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { BottomTabBar } from "@/components/BottomTabBar";
import { MaterialIcon } from "@/components/MaterialIcon";
import { useEntries } from "@/lib/hooks/useEntries";
import { useDecryptedEntries } from "@/lib/hooks/useDecryptedEntries";
import { computeStreak } from "@/lib/streak";
import { useSessionStore } from "@/lib/store/session";
import { useTone } from "@/lib/hooks/useTone";
import type { Tone } from "@/lib/tone";

const MOOD_OPTIONS: { value: number; color: string; label: string }[] = [
  { value: 1, color: "bg-mood-rose", label: "Struggling" },
  { value: 2, color: "bg-mood-rose", label: "Low" },
  { value: 3, color: "bg-mood-ochre", label: "Steady" },
  { value: 4, color: "bg-mood-sage", label: "Good" },
  { value: 5, color: "bg-mood-sage", label: "Great" },
];

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
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function EmptyHome() {
  return (
    <div className="font-editorial-sans mx-auto flex min-h-screen w-full max-w-md flex-col bg-surface text-on-surface">
      <header className="flex justify-center items-center relative px-4 h-16 flex-shrink-0">
        <MaterialIcon name="lock" className="absolute left-4 text-primary" size={22} />
        <span className="font-editorial-display text-lg text-primary">The Nook</span>
        <Link href="/settings" aria-label="Settings" className="absolute right-4 text-primary">
          <MaterialIcon name="settings" size={20} />
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-24 gap-stack-gap text-center">
        <div className="w-56 h-56 md:w-64 md:h-64 rounded-full overflow-hidden shadow-[0_10px_40px_-15px_rgba(74,101,78,0.2)] bg-surface-container animate-breathe">
          {/* eslint-disable-next-line @next/next/no-img-element -- static decorative asset, no next/image srcset needed */}
          <img src="/images/hero-dawn.jpg" alt="" className="h-full w-full object-cover" aria-hidden="true" />
        </div>

        <div className="flex flex-col gap-2 max-w-xs">
          <h1 className="font-editorial-display text-headline-md text-on-surface">A Quiet Beginning.</h1>
          <p className="text-body-lg text-on-surface-variant">
            Your sanctuary is ready. When you&rsquo;re ready to share your first thought, tap below.
          </p>
        </div>

        <Link
          href="/write"
          className="bg-primary text-on-primary hover:bg-surface-tint active:scale-95 transition-all rounded-full px-8 py-4 flex items-center gap-2 shadow-[0_4px_12px_rgba(74,101,78,0.15)] text-label-sm"
        >
          <MaterialIcon name="history_edu" size={18} />
          New Entry
        </Link>
        <Link href="/write?mode=voice" className="text-label-sm text-outline hover:text-primary transition-colors">
          or record a voice note
        </Link>

        <div className="mt-4 flex items-center gap-1.5 text-outline">
          <MaterialIcon name="lock" filled size={14} />
          <span className="text-label-sm">End-to-End Encrypted</span>
        </div>
      </main>

      <BottomTabBar />
    </div>
  );
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

  if (!entriesLoading && (entries ?? []).length === 0) {
    return <EmptyHome />;
  }

  return (
    <div className="font-editorial-sans mx-auto flex min-h-screen w-full max-w-md flex-col bg-surface text-on-surface">
      <header className="flex justify-center items-center relative px-4 h-16 flex-shrink-0">
        <MaterialIcon name="lock" filled className="absolute left-4 text-primary" size={20} />
        <span className="font-editorial-display text-title-md text-primary">The Nook</span>
        <Link href="/settings" aria-label="Settings" className="absolute right-4 text-primary">
          <MaterialIcon name="settings" size={20} />
        </Link>
      </header>

      <main className="flex flex-1 flex-col gap-stack-gap px-container-padding pt-2 pb-3">
        <div>
          <h1 className="font-editorial-display text-headline-md text-on-surface">
            {greeting}
            {user?.firstName ? `, ${user.firstName}` : ""}
          </h1>
          {streak > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-label-sm text-outline">
              <MaterialIcon name="eco" filled size={16} className="text-primary" />
              {entriesLoading ? "…" : `${streak} ${streak === 1 ? "day" : "days"} gently woven together`}
            </div>
          )}
        </div>

        <div className="bg-surface-container-low rounded-xl p-6 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 opacity-5 pointer-events-none">
            <MaterialIcon name="format_quote" size={100} className="text-primary" />
          </div>
          <div className="relative z-10 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-primary text-label-sm">
              <MaterialIcon name="psychology" size={16} />
              Morning Reflection
            </div>
            <p className="font-editorial-display text-body-lg text-on-surface leading-snug">
              {promptLoading ? "Thinking of something to ask you…" : promptData?.prompt}
            </p>

            <div className="flex items-center gap-3 mt-1">
              {MOOD_OPTIONS.map((opt) => {
                const active = selectedMood === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-label={opt.label}
                    aria-pressed={active}
                    onClick={() => setSelectedMood(opt.value)}
                    className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${
                      active ? "border-2 border-primary bg-surface-container-lowest" : "border-surface-variant hover:bg-surface-container-lowest"
                    }`}
                  >
                    <div className={`rounded-full ${opt.color} ${active ? "w-3.5 h-3.5" : "w-2.5 h-2.5 opacity-40"}`} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Link
            href={selectedMood ? `/write?mood=${selectedMood}` : "/write"}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-label-sm text-on-primary hover:bg-surface-tint transition-colors active:scale-95"
          >
            <MaterialIcon name="edit_document" size={16} />
            New entry
          </Link>
          <Link
            href="/write?mode=voice"
            aria-label="Record a voice entry"
            className="flex w-12 items-center justify-center rounded-full border border-outline-variant/60 bg-surface-container-lowest text-secondary hover:bg-surface-container-low transition-colors active:scale-95"
          >
            <MaterialIcon name="mic" size={18} />
          </Link>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-label-sm text-outline uppercase tracking-wider">Recent Thoughts</span>
            <Link href="/journal" className="text-label-sm text-primary">
              View All
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {recentEntries.map((entry) => {
              const snippet = snippets[entry.id];
              const moodLabel = entry.mood_score ? MOOD_OPTIONS[entry.mood_score - 1]?.label : null;
              return (
                <Link
                  key={entry.id}
                  href={`/journal/${entry.id}`}
                  className="py-3 px-4 -mx-4 rounded-lg hover:bg-surface-container-lowest transition-colors border border-transparent hover:border-surface-variant"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-label-sm text-outline">{formatDay(entry.created_at)}</span>
                    {moodLabel && (
                      <span className="bg-surface-container-high text-on-surface-variant text-label-sm px-2 py-0.5 rounded-full">
                        {moodLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-body-md text-on-surface line-clamp-2">
                    {snippet === undefined ? "…" : snippet || "(couldn't decrypt this entry)"}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </main>

      <BottomTabBar />
    </div>
  );
}
