"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/MaterialIcon";
import { useEntries } from "@/lib/hooks/useEntries";
import { periodRange, entriesInRange, topTag, type Period } from "@/lib/period";

const PERIODS: { key: Period; label: string }[] = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

const MOOD_LABEL: Record<number, string> = {
  1: "Struggling",
  2: "Low",
  3: "Steady",
  4: "Good",
  5: "Great",
};

const TABS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/write", label: "Journal", icon: "edit_note" },
  { href: "/playback", label: "Playback", icon: "play_circle" },
  { href: "/manifestations", label: "Manifest", icon: "auto_awesome" },
];

function mostCommonMood(scores: number[]): string | null {
  if (scores.length === 0) return null;
  const counts = new Map<number, number>();
  for (const s of scores) counts.set(s, (counts.get(s) ?? 0) + 1);
  let best = scores[0];
  let bestCount = 0;
  for (const [score, count] of counts) {
    if (count > bestCount) {
      best = score;
      bestCount = count;
    }
  }
  return MOOD_LABEL[best] ?? null;
}

export default function PlaybackPage() {
  const router = useRouter();
  const { data: entries, isLoading } = useEntries();
  const [selected, setSelected] = useState<Period>("week");

  const periodEntries = useMemo(() => {
    if (!entries) return [];
    const { start, end } = periodRange(selected);
    return entriesInRange(entries, start, end);
  }, [entries, selected]);

  const tag = topTag(periodEntries);
  const mostlyMood = useMemo(
    () => mostCommonMood(periodEntries.filter((e) => e.mood_score != null).map((e) => e.mood_score!)),
    [periodEntries],
  );
  const hasAnyEntries = (entries ?? []).length > 0;

  if (!isLoading && !hasAnyEntries) {
    return (
      <div className="font-editorial-sans bg-surface text-on-surface antialiased min-h-screen relative flex flex-col overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center">
          <div className="w-[120vw] h-[120vw] rounded-full bg-surface-container-high opacity-20 blur-3xl" />
        </div>

        <main className="flex-1 flex flex-col items-center justify-center px-container-padding py-stack-gap relative z-10 text-center">
          <div className="w-full aspect-square max-w-[240px] mb-8 rounded-full overflow-hidden bg-surface-container-low shadow-sm border border-outline-variant/30">
            {/* eslint-disable-next-line @next/next/no-img-element -- static decorative asset */}
            <img src="/images/hero-dawn.jpg" alt="" className="object-cover w-full h-full" aria-hidden="true" />
          </div>
          <h1 className="font-editorial-display text-headline-lg-mobile md:text-display-lg text-primary mb-4">
            Your story is being woven.
          </h1>
          <p className="text-body-lg text-on-surface-variant mb-8 max-w-xs mx-auto">
            Write a few entries and we&rsquo;ll turn them into a story.
          </p>
          <button
            type="button"
            onClick={() => router.push("/write")}
            className="bg-primary text-on-primary hover:bg-surface-tint text-label-sm uppercase tracking-widest px-8 py-4 rounded-full transition-colors shadow-sm flex items-center gap-2"
          >
            <MaterialIcon name="edit" size={18} />
            Start a new entry
          </button>
        </main>

        <nav className="fixed bottom-0 w-full z-50 rounded-t-xl bg-surface-container-low flex justify-around items-center px-gutter py-stack-loose pb-safe md:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.02)] border-t border-outline-variant/10">
          {TABS.map((tab) => (
            <a
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center transition-transform duration-300 active:scale-90 ${
                tab.href === "/playback"
                  ? "text-on-primary-container bg-primary-container rounded-full px-4 py-1"
                  : "text-outline hover:text-primary"
              }`}
            >
              <MaterialIcon name={tab.icon} filled={tab.href === "/playback"} className="mb-1" />
              <span className="text-label-sm">{tab.label}</span>
            </a>
          ))}
        </nav>
      </div>
    );
  }

  return (
    <div className="font-editorial-sans bg-inverse-surface text-inverse-on-surface antialiased min-h-screen relative">
      <main className="min-h-screen pb-32 px-container-padding pt-12">
        {isLoading && <p className="text-sm text-inverse-on-surface/60">Loading…</p>}

        <div className="flex justify-center mb-12">
          <div className="inline-flex bg-inverse-surface border border-outline/30 rounded-full p-1 shadow-sm">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setSelected(p.key)}
                className={`px-6 py-2 rounded-full text-label-sm transition-all ${
                  p.key === selected
                    ? "bg-primary-container text-on-primary-container"
                    : "text-inverse-on-surface hover:text-inverse-primary"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <section className="flex flex-col items-center text-center space-y-stack-gap max-w-lg mx-auto">
          <div className="space-y-4">
            <h2 className="font-editorial-display text-headline-lg-mobile md:text-display-lg text-inverse-on-surface">
              Your Past {PERIODS.find((p) => p.key === selected)?.label}
            </h2>
            <p className="text-body-lg text-inverse-on-surface/80 max-w-md mx-auto">
              A gentle look back at your recent thoughts and moments.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full mt-8">
            <div className="bg-surface-container-high/10 border border-outline/20 rounded-xl p-6 flex flex-col items-center justify-center space-y-2 backdrop-blur-sm">
              <MaterialIcon name="book_5" filled className="text-inverse-primary" size={28} />
              <span className="font-editorial-display text-headline-md text-inverse-on-surface">
                {periodEntries.length}
              </span>
              <span className="text-label-sm text-inverse-on-surface/60 uppercase tracking-wider">Entries</span>
            </div>
            <div className="bg-surface-container-high/10 border border-outline/20 rounded-xl p-6 flex flex-col items-center justify-center space-y-2 backdrop-blur-sm">
              <MaterialIcon name="spa" filled className="text-inverse-primary" size={28} />
              <span className="font-editorial-display text-headline-md text-inverse-on-surface">
                {mostlyMood ?? "—"}
              </span>
              <span className="text-label-sm text-inverse-on-surface/60 uppercase tracking-wider">Mostly</span>
            </div>
            {tag && (
              <div className="col-span-2 bg-surface-container-high/10 border border-outline/20 rounded-xl p-6 flex flex-row items-center justify-between backdrop-blur-sm">
                <div className="flex items-center space-x-3">
                  <MaterialIcon name="psychiatry" filled className="text-inverse-primary" />
                  <span className="text-body-md text-inverse-on-surface/80">Top Theme</span>
                </div>
                <span className="font-editorial-display text-headline-md text-inverse-on-surface">{tag}</span>
              </div>
            )}
          </div>

          <div className="w-full pt-8">
            <button
              type="button"
              onClick={() => periodEntries.length > 0 && router.push(`/playback/story?period=${selected}`)}
              disabled={periodEntries.length === 0}
              className="w-full bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-editorial-display text-headline-md py-5 rounded-full transition-all transform hover:scale-[1.02] shadow-[0_4px_14px_0_rgba(139,168,142,0.15)] flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
            >
              <MaterialIcon name="play_circle" filled />
              {periodEntries.length > 0
                ? `Play Your ${PERIODS.find((p) => p.key === selected)?.label}`
                : `Write a few entries this ${selected} to unlock a recap`}
            </button>
          </div>

          <div className="flex items-center justify-center space-x-1 mt-8 opacity-70">
            <MaterialIcon name="lock" size={16} />
            <span className="text-label-sm text-inverse-on-surface">End-to-End Encrypted</span>
          </div>
        </section>
      </main>

      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-3 bg-inverse-surface/90 backdrop-blur-md rounded-t-xl border-t-0 shadow-sm md:hidden">
        {TABS.map((tab) => (
          <a
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center justify-center transition-all duration-200 ${
              tab.href === "/playback"
                ? "bg-primary-container text-on-primary-container rounded-full px-4 py-1"
                : "text-on-surface-variant hover:text-inverse-primary"
            }`}
          >
            <MaterialIcon name={tab.icon} filled={tab.href === "/playback"} />
            <span className="text-label-sm mt-1">{tab.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
