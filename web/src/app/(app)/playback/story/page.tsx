"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEntries, type EntryMetadata } from "@/lib/hooks/useEntries";
import { useDecryptedEntries } from "@/lib/hooks/useDecryptedEntries";
import { usePlaybackNarrative } from "@/lib/hooks/usePlaybackNarrative";
import { useSessionStore } from "@/lib/store/session";
import {
  periodRange,
  entriesInRange,
  findComparisonPair,
  type Period,
} from "@/lib/period";

const MOOD_WORD: Record<number, string> = {
  1: "Struggling",
  2: "Low",
  3: "Steady",
  4: "Good",
  5: "Great",
};

type Card =
  | { kind: "mood"; headline: string; summary: string; points: number[] }
  | { kind: "highlight"; quote: string; dateLabel: string; entryId?: string }
  | {
      kind: "compare";
      thenDate: string;
      thenText: string;
      thenMood?: number;
      nowDate: string;
      nowText: string;
      nowMood?: number;
    }
  | { kind: "letter"; text: string };

function shortDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "long" });
}

function StoryContent() {
  const params = useSearchParams();
  const router = useRouter();
  const period = (params.get("period") as Period) ?? "week";

  const { data: entries } = useEntries();
  const dek = useSessionStore((s) => s.dek);
  const narrative = usePlaybackNarrative();
  const startedRef = useRef(false);
  const [index, setIndex] = useState(0);

  const periodEntries = useMemo(() => {
    if (!entries) return [];
    const { start, end } = periodRange(period);
    return entriesInRange(entries, start, end);
  }, [entries, period]);

  const comparisonPair = useMemo(
    () => (entries ? findComparisonPair(entries, periodEntries) : null),
    [entries, periodEntries],
  );

  const toDecrypt = useMemo(() => {
    const list = [...periodEntries];
    if (comparisonPair) {
      if (!list.find((e) => e.id === comparisonPair.then.id)) list.push(comparisonPair.then);
      if (!list.find((e) => e.id === comparisonPair.now.id)) list.push(comparisonPair.now);
    }
    return list;
  }, [periodEntries, comparisonPair]);

  const decrypted = useDecryptedEntries(toDecrypt, dek);
  const allDecrypted = toDecrypt.length > 0 && toDecrypt.every((e) => decrypted[e.id] !== undefined);

  useEffect(() => {
    if (startedRef.current) return;
    if (!allDecrypted || periodEntries.length === 0) return;
    startedRef.current = true;

    narrative.mutate({
      period,
      entryPlaintexts: periodEntries.map((e) => ({
        date: shortDay(e.created_at),
        text: decrypted[e.id] ?? "",
        mood: e.mood_score ?? 3,
      })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDecrypted, periodEntries.length]);

  const cards = useMemo((): Card[] => {
    if (!narrative.data) return [];
    const result: Card[] = [];

    const scored = periodEntries.filter((e): e is EntryMetadata & { mood_score: number } =>
      e.mood_score != null,
    );
    result.push({
      kind: "mood",
      headline: narrative.data.headline,
      summary: narrative.data.moodTrendSummary,
      points: scored.map((e) => e.mood_score),
    });

    if (narrative.data.highlightQuote) {
      const matchingEntry = periodEntries.find(
        (e) => shortDay(e.created_at) === narrative.data!.highlightDate,
      );
      result.push({
        kind: "highlight",
        quote: narrative.data.highlightQuote,
        dateLabel: narrative.data.highlightDate || "this period",
        entryId: matchingEntry?.id,
      });
    }

    if (comparisonPair && decrypted[comparisonPair.then.id] && decrypted[comparisonPair.now.id]) {
      result.push({
        kind: "compare",
        thenDate: new Date(comparisonPair.then.created_at).toLocaleDateString(undefined, {
          month: "short",
          year: "numeric",
        }),
        thenText: decrypted[comparisonPair.then.id].slice(0, 110),
        thenMood: comparisonPair.then.mood_score ?? undefined,
        nowDate: "Today",
        nowText: decrypted[comparisonPair.now.id].slice(0, 110),
        nowMood: comparisonPair.now.mood_score ?? undefined,
      });
    }

    if (narrative.data.letter) {
      result.push({ kind: "letter", text: narrative.data.letter });
    }

    return result;
  }, [narrative.data, periodEntries, comparisonPair, decrypted]);

  function next() {
    if (index < cards.length - 1) setIndex(index + 1);
    else router.push("/playback");
  }
  function prev() {
    if (index > 0) setIndex(index - 1);
  }

  if (!allDecrypted || narrative.isPending || cards.length === 0) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-2 bg-[#2c3a2c] px-6 text-center text-[#f6f4ee]">
        <p className="text-sm">Putting your {period} together…</p>
        {narrative.isError && (
          <>
            <p className="text-xs text-[#e0dccf]">Couldn&rsquo;t generate this recap.</p>
            <button type="button" onClick={() => router.push("/playback")} className="text-xs font-semibold underline">
              Back
            </button>
          </>
        )}
      </div>
    );
  }

  const card = cards[index];

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col overflow-hidden bg-[#2c3a2c] text-[#f6f4ee]">
      <div className="flex flex-shrink-0 gap-1 px-3 pt-2.5">
        {cards.map((_, i) => (
          <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
            <div className="h-full bg-white" style={{ width: i <= index ? "100%" : "0%" }} />
          </div>
        ))}
      </div>

      <div className="flex flex-shrink-0 items-center justify-between px-3.5 py-2.5">
        <span className="text-[10px] text-white/65">Your {period} playback</span>
        <Link href="/playback" aria-label="Close" className="text-white/80">
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M4.5 4.5l11 11M15.5 4.5l-11 11" />
          </svg>
        </Link>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-4 px-7 pb-16 text-center">
        {card.kind === "mood" && (
          <>
            {card.points.length > 1 && (
              <svg viewBox="0 0 220 60" width="200" height="60" fill="none">
                <polyline
                  points={card.points
                    .map((p, i) => `${(i / (card.points.length - 1)) * 220},${60 - (p / 5) * 55}`)
                    .join(" ")}
                  stroke="#9fd18a"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            <div className="text-xl font-bold leading-snug">{card.headline}</div>
            <div className="text-xs text-white/75">{card.summary}</div>
          </>
        )}

        {card.kind === "highlight" && (
          <>
            <div className="font-serif text-5xl text-[#b7d9a8]">&ldquo;</div>
            <div className="font-serif text-lg italic leading-snug">{card.quote}</div>
            <div className="text-xs text-white/65">You wrote this on {card.dateLabel}</div>
            {card.entryId && (
              <Link
                href={`/journal/${card.entryId}`}
                className="mt-1 rounded-full border border-white/35 px-3 py-1.5 text-[11px] text-[#cfe4c2]"
              >
                Read the full entry
              </Link>
            )}
          </>
        )}

        {card.kind === "compare" && (
          <>
            <div className="text-base font-bold">Same topic, different tone</div>
            <div className="flex w-full gap-2">
              <div className="flex-1 rounded-[10px] border border-white/30 p-3 text-left">
                <div className="text-[9px] uppercase text-white/55">{card.thenDate}</div>
                <div className="mt-1.5 text-[11px] leading-relaxed text-white/90">
                  &ldquo;{card.thenText}…&rdquo;
                </div>
                {card.thenMood && (
                  <div className="mt-2 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[9px]">
                    {MOOD_WORD[card.thenMood]}
                  </div>
                )}
              </div>
              <div className="flex-1 rounded-[10px] border border-white/30 p-3 text-left">
                <div className="text-[9px] uppercase text-white/55">{card.nowDate}</div>
                <div className="mt-1.5 text-[11px] leading-relaxed text-white/90">
                  &ldquo;{card.nowText}…&rdquo;
                </div>
                {card.nowMood && (
                  <div className="mt-2 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[9px]">
                    {MOOD_WORD[card.nowMood]}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {card.kind === "letter" && (
          <>
            <svg viewBox="0 0 20 20" width="30" height="30" fill="none" stroke="#cfe4c2" strokeWidth="1.3">
              <rect x="2" y="4.5" width="16" height="11" rx="1.5" />
              <path d="M2.5 5.5L10 11l7.5-5.5" />
            </svg>
            <div className="text-sm font-semibold text-white/75">A note from your past self</div>
            <div className="font-serif text-base italic leading-relaxed">{card.text}</div>
            <Link
              href="/write"
              className="mt-1 rounded-full bg-white px-3.5 py-2 text-[11px] font-semibold text-[#2f4a3a]"
            >
              Write to future self
            </Link>
          </>
        )}

        <button
          type="button"
          onClick={prev}
          aria-label="Previous"
          className="absolute inset-y-0 left-0 w-1/3"
        />
        <button
          type="button"
          onClick={next}
          aria-label="Next"
          className="absolute inset-y-0 right-0 w-2/3"
        />
      </div>
    </div>
  );
}

export default function StoryPage() {
  return (
    <Suspense fallback={null}>
      <StoryContent />
    </Suspense>
  );
}
