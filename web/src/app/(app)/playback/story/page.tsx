"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MaterialIcon } from "@/components/MaterialIcon";
import { useEntries, type EntryMetadata } from "@/lib/hooks/useEntries";
import { useDecryptedEntries } from "@/lib/hooks/useDecryptedEntries";
import { usePlaybackNarrative } from "@/lib/hooks/usePlaybackNarrative";
import { useSessionStore } from "@/lib/store/session";
import { useTone } from "@/lib/hooks/useTone";
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

const LOADING_MESSAGES = [
  { title: "Stitching together your quiet moments…", subtitle: "Finding the threads of growth." },
  { title: "Weaving your thoughts into patterns…", subtitle: "Reflecting on your journey." },
  { title: "Discovering the underlying themes…", subtitle: "Organizing your mental space." },
];

type Card =
  | { kind: "mood"; headline: string; summary: string; points: { score: number; date: string }[] }
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

function LoadingState({ isError, onBack }: { isError: boolean; onBack: () => void }) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (isError) return;
    const id = setInterval(() => setMessageIndex((i) => (i + 1) % LOADING_MESSAGES.length), 6000);
    return () => clearInterval(id);
  }, [isError]);

  if (isError) {
    return (
      <div className="font-editorial-sans mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-2 bg-inverse-surface px-6 text-center text-inverse-on-surface">
        <p className="text-sm text-inverse-on-surface/70">Couldn&rsquo;t generate this recap.</p>
        <button type="button" onClick={onBack} className="text-xs font-semibold underline">
          Back
        </button>
      </div>
    );
  }

  const message = LOADING_MESSAGES[messageIndex];

  return (
    <div className="font-editorial-sans bg-inverse-surface text-inverse-on-surface h-screen w-full flex flex-col justify-between overflow-hidden antialiased">
      <div className="w-full px-container-padding pt-unit flex items-center gap-unit">
        <div className="h-1 flex-1 bg-surface-variant/20 rounded-full overflow-hidden">
          <div className="h-full bg-primary-fixed animate-pulse rounded-full w-full" />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-1 flex-1 bg-surface-variant/20 rounded-full" />
        ))}
      </div>

      <main className="flex-1 flex flex-col items-center justify-center px-container-padding">
        <MaterialIcon name="eco" filled size={56} className="text-primary-fixed mb-stack-gap animate-pulse" />
        <div className="text-center h-20">
          <h1 className="font-editorial-display text-headline-lg-mobile md:text-display-lg text-primary-fixed mb-1">
            {message.title}
          </h1>
          <p className="text-body-md text-inverse-on-surface/70">{message.subtitle}</p>
        </div>
      </main>

      <div className="w-full px-container-padding pb-container-padding flex items-center justify-center gap-2 opacity-60">
        <MaterialIcon name="lock" size={16} />
        <span className="text-label-sm uppercase">End-to-End Encrypted</span>
      </div>
    </div>
  );
}

function StoryContent() {
  const params = useSearchParams();
  const router = useRouter();
  const period = (params.get("period") as Period) ?? "week";

  const { data: entries } = useEntries();
  const dek = useSessionStore((s) => s.dek);
  const { tone } = useTone();
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
      tone,
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
      points: scored.map((e) => ({
        score: e.mood_score,
        date: new Date(e.created_at).toLocaleDateString(undefined, { weekday: "narrow" }),
      })),
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
          day: "numeric",
          year: "numeric",
        }),
        thenText: decrypted[comparisonPair.then.id].slice(0, 140),
        thenMood: comparisonPair.then.mood_score ?? undefined,
        nowDate: "Today",
        nowText: decrypted[comparisonPair.now.id].slice(0, 140),
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
    return <LoadingState isError={narrative.isError} onBack={() => router.push("/playback")} />;
  }

  const card = cards[index];

  // Compare card gets its own full-bleed split-screen treatment; every
  // other card shares the standard centered story layout.
  if (card.kind === "compare") {
    return (
      <div className="font-editorial-sans bg-surface-dim dark:bg-[#1a1c1a] text-on-surface w-full h-screen overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full px-4 py-4 z-50 flex gap-1 items-center">
          {cards.map((_, i) => (
            <div key={i} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: i <= index ? "100%" : "0%" }} />
            </div>
          ))}
        </div>
        <div className="absolute top-8 left-0 w-full px-container-padding z-40 flex justify-between items-center mix-blend-difference text-white">
          <h1 className="text-headline-md tracking-tight opacity-90">Same topic, different tone.</h1>
          <Link href="/playback" aria-label="Close" className="p-2 rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/40 transition-colors">
            <MaterialIcon name="close" />
          </Link>
        </div>

        <main className="flex-1 flex flex-col w-full h-full relative">
          <section className="flex-1 flex flex-col justify-center items-center px-container-padding relative bg-tertiary/20 dark:bg-[#251b1e]">
            <div className="relative z-10 max-w-md w-full text-center space-y-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1a1c1a]/40 text-tertiary-fixed-dim text-label-sm border border-tertiary-fixed-dim/30">
                <MaterialIcon name="history" size={14} />
                Back then, you felt…
              </div>
              <blockquote className="font-editorial-display text-headline-lg-mobile md:text-display-lg text-tertiary-fixed dark:text-[#f8d0d9] italic opacity-90">
                &ldquo;{card.thenText}…&rdquo;
              </blockquote>
              <p className="text-body-md text-outline-variant/70 uppercase tracking-widest mt-8">
                {card.thenDate}
                {card.thenMood && ` · ${MOOD_WORD[card.thenMood]}`}
              </p>
            </div>
          </section>

          <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-white/20 to-transparent relative z-20" />

          <section className="flex-1 flex flex-col justify-center items-center px-container-padding relative bg-primary-container/10 dark:bg-[#1a231e]">
            <div className="relative z-10 max-w-md w-full text-center space-y-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-container/20 text-primary-fixed text-label-sm border border-primary-fixed/30">
                <MaterialIcon name="self_improvement" size={14} />
                {card.nowDate}, you noticed…
              </div>
              <blockquote className="font-editorial-display text-headline-lg-mobile md:text-display-lg text-primary-fixed dark:text-[#d3f1d5]">
                &ldquo;{card.nowText}…&rdquo;
              </blockquote>
              {card.nowMood && (
                <p className="text-body-md text-outline-variant/70 uppercase tracking-widest mt-8">
                  {MOOD_WORD[card.nowMood]}
                </p>
              )}
            </div>
          </section>
        </main>

        <div className="absolute inset-0 w-full h-full z-50 flex pointer-events-none">
          <button type="button" onClick={prev} aria-label="Previous" className="w-1/3 h-full pointer-events-auto" />
          <button type="button" onClick={next} aria-label="Next" className="w-2/3 h-full pointer-events-auto" />
        </div>
      </div>
    );
  }

  // Letter card gets its own atmospheric full-bleed treatment.
  if (card.kind === "letter") {
    return (
      <div className="font-editorial-sans bg-inverse-surface text-inverse-on-surface h-screen w-full overflow-hidden flex flex-col relative">
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-inverse-surface/40 via-inverse-surface/70 to-inverse-surface pointer-events-none" />
        <div className="w-full flex items-center gap-inline-gap px-container-padding pt-6 pb-4 relative z-10">
          {cards.map((_, i) => (
            <div key={i} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: i <= index ? "100%" : "0%" }} />
            </div>
          ))}
        </div>
        <Link
          href="/playback"
          aria-label="Close"
          className="absolute top-6 right-container-padding z-20 p-2 rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/40 transition-colors"
        >
          <MaterialIcon name="close" />
        </Link>

        <main className="flex-grow flex flex-col items-center justify-center px-container-padding relative z-10 w-full max-w-lg mx-auto text-center">
          <MaterialIcon name="mail" size={40} className="text-primary-fixed-dim opacity-80 mb-6" />
          <h1 className="font-editorial-display text-headline-lg-mobile md:text-display-lg text-white mb-4 leading-tight">
            A note from your past self.
          </h1>
          <div className="w-full max-w-md bg-inverse-surface/40 backdrop-blur-md rounded-2xl p-6 border border-white/10 shadow-2xl">
            <p className="text-body-lg italic leading-relaxed text-inverse-on-surface/90">{card.text}</p>
          </div>
        </main>

        <div className="w-full px-container-padding pb-8 pt-4 flex flex-col items-center relative z-10 max-w-lg mx-auto gap-4">
          <Link
            href="/write"
            className="w-full bg-primary-fixed-dim text-on-primary-container text-label-sm py-4 rounded-xl shadow-lg hover:bg-primary-fixed transition-colors flex items-center justify-center gap-2 text-center"
          >
            Write to future self
            <MaterialIcon name="send" filled size={18} />
          </Link>
        </div>

        <div className="absolute inset-0 w-full h-full z-30 flex pointer-events-none">
          <button type="button" onClick={prev} aria-label="Previous" className="w-1/3 h-full pointer-events-auto" />
          <button type="button" onClick={next} aria-label="Next" className="w-2/3 h-full pointer-events-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="font-editorial-sans h-screen w-full flex flex-col overflow-hidden relative selection:bg-primary-container selection:text-on-primary-container">
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a1a] to-[#121212] z-[-1]" />
      <div
        className="absolute inset-0 opacity-20 pointer-events-none z-[-1]"
        style={{ background: "radial-gradient(circle at 50% 50%, rgba(139, 168, 142, 0.15) 0%, transparent 60%)" }}
      />

      <div className="w-full flex flex-col px-4 pt-12 pb-4 sticky top-0 z-50">
        <div className="flex gap-2 w-full mb-6">
          {cards.map((_, i) => (
            <div key={i} className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: i <= index ? "100%" : "0%" }} />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between w-full">
          <span className="w-10" />
          <div className="text-label-sm text-white/50 uppercase tracking-widest">Playback</div>
          <Link href="/playback" aria-label="Close" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
            <MaterialIcon name="close" className="text-white" />
          </Link>
        </div>
      </div>

      <main className="flex-grow flex flex-col px-container-padding py-8 h-full relative">
        {card.kind === "mood" && (
          <>
            <div className="mb-12 mt-4 text-center">
              <h1 className="font-editorial-display text-headline-lg-mobile md:text-display-lg text-white mb-2 font-medium tracking-tight">
                {card.headline}
              </h1>
              <p className="text-body-md text-white/60">{card.summary}</p>
            </div>

            {card.points.length > 1 ? (
              <div className="relative w-full flex-grow max-h-[400px] flex flex-col rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md p-6 overflow-hidden">
                <div className="absolute left-6 top-6 bottom-16 flex flex-col justify-between text-label-sm text-white/50 z-10">
                  <span className="opacity-70">Great</span>
                  <span className="opacity-70">Steady</span>
                  <span className="opacity-70">Struggling</span>
                </div>
                <div className="w-full h-full relative pl-16 pb-8">
                  <svg className="overflow-visible" height="100%" preserveAspectRatio="none" viewBox="0 0 400 300" width="100%">
                    <line stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" x1="0" x2="400" y1="20" y2="20" />
                    <line stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" x1="0" x2="400" y1="150" y2="150" />
                    <line stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" x1="0" x2="400" y1="280" y2="280" />
                    <path
                      d={card.points
                        .map((p, i) => {
                          const x = (i / (card.points.length - 1)) * 400;
                          const y = 280 - ((p.score - 1) / 4) * 260;
                          return `${i === 0 ? "M" : "L"}${x},${y}`;
                        })
                        .join(" ")}
                      fill="none"
                      stroke="#8ba88e"
                      strokeLinecap="round"
                      strokeWidth="4"
                    />
                    {card.points.map((p, i) => {
                      const x = (i / (card.points.length - 1)) * 400;
                      const y = 280 - ((p.score - 1) / 4) * 260;
                      return <circle key={i} cx={x} cy={y} fill="#121212" r="4" stroke="#8ba88e" strokeWidth="2" />;
                    })}
                  </svg>
                </div>
                <div className="absolute bottom-6 left-16 right-6 flex justify-between text-label-sm text-white/50 z-10">
                  {card.points.map((p, i) => (
                    <span key={i}>{p.date}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-grow" />
            )}
          </>
        )}

        {card.kind === "highlight" && (
          <div className="flex-1 flex flex-col justify-center items-center gap-8 text-center">
            <blockquote className="font-editorial-display text-headline-lg-mobile md:text-display-lg text-white leading-tight">
              &ldquo;{card.quote}&rdquo;
            </blockquote>
            <span className="text-label-sm text-primary-fixed-dim tracking-widest uppercase">
              {card.dateLabel}
            </span>
            {card.entryId && (
              <Link
                href={`/journal/${card.entryId}`}
                className="flex items-center gap-2 text-body-md text-surface-dim hover:text-surface-bright transition-colors"
              >
                Read full entry
                <MaterialIcon name="arrow_forward" size={18} />
              </Link>
            )}
          </div>
        )}

        <div className="mt-auto pt-8 pb-4 flex justify-center items-center gap-2 opacity-50">
          <MaterialIcon name="lock" size={16} className="text-white" />
          <span className="text-label-sm text-white">End-to-End Encrypted</span>
        </div>

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
      </main>
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
