"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { BottomTabBar } from "@/components/BottomTabBar";
import { MaterialIcon } from "@/components/MaterialIcon";
import { useEntries } from "@/lib/hooks/useEntries";
import { useDecryptedEntries } from "@/lib/hooks/useDecryptedEntries";
import { useSessionStore } from "@/lib/store/session";
import { useSemanticSearch, type SearchResult } from "@/lib/search/useSemanticSearch";

const MOOD_LABEL: Record<number, string> = {
  1: "Struggling",
  2: "Low",
  3: "Steady",
  4: "Good",
  5: "Great",
};

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function SearchPage() {
  const dek = useSessionStore((s) => s.dek);
  const { data: entries } = useEntries();
  const decrypted = useDecryptedEntries(entries, dek);
  const {
    status,
    indexedCount,
    totalCount,
    modelProgress,
    modelReady,
    error,
    enable,
    disable,
    search,
  } = useSemanticSearch();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTokenRef = useRef(0);

  // Debounced search-as-you-type, triggered from the input handler rather
  // than an effect keyed on `query` — every setState call below happens
  // inside a real callback (the handler itself, or the timeout/promise
  // callbacks), never synchronously in an effect body. searchTokenRef
  // guards against an in-flight older search resolving after a newer one
  // and clobbering its results.
  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (status !== "ready" || !value.trim()) {
      setSearching(false);
      return;
    }

    setSearching(true);
    const token = ++searchTokenRef.current;
    debounceRef.current = setTimeout(() => {
      search(value).then((r) => {
        if (searchTokenRef.current === token) {
          setResults(r.slice(0, 10));
          setSearching(false);
        }
      });
    }, 300);
  }

  const entryById = useMemo(() => {
    const map = new Map((entries ?? []).map((e) => [e.id, e]));
    return map;
  }, [entries]);

  return (
    <div className="font-editorial-sans mx-auto flex min-h-screen w-full max-w-md flex-col bg-background text-on-background pb-24">
      <AppHeader />

      <main className="flex-grow px-container-padding pt-2 max-w-3xl mx-auto w-full">
        <div className="mb-stack-gap">
          <h1 className="font-editorial-display text-headline-lg-mobile text-primary tracking-tight mb-1">
            Smart Search
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Find entries by what they mean, not just the words in them.
          </p>
        </div>

        {status === "checking" && (
          <p className="text-sm text-on-surface-variant">Checking your search index…</p>
        )}

        {status === "empty" && (
          <div className="flex flex-col items-center gap-2 pt-16 text-center">
            <MaterialIcon name="travel_explore" size={40} className="text-outline-variant mb-2" />
            <h2 className="font-editorial-display text-headline-md text-on-background">
              Nothing to search yet
            </h2>
            <p className="text-body-md text-outline max-w-xs">
              Write a few entries first — Smart Search needs something to look through.
            </p>
          </div>
        )}

        {status === "needs-opt-in" && (
          <div className="rounded-xl bg-surface-container-low p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-primary text-label-sm">
              <MaterialIcon name="privacy_tip" size={16} />
              How this works
            </div>
            <p className="text-body-md text-on-surface leading-relaxed">
              Smart Search runs entirely on this device. Your entries are decrypted
              locally, turned into a search index, and re-encrypted before being stored
              here — nothing is ever sent to a server, and this works the same offline
              as it does online.
            </p>
            <p className="text-label-sm text-outline">
              The first time, it downloads a small (~34MB) model to this device. After
              that, search stays on this device — no more downloads, no more waiting on
              a network.
            </p>
            <button
              type="button"
              onClick={enable}
              className="bg-primary text-on-primary text-label-sm py-3 rounded-full hover:bg-surface-tint transition-colors"
            >
              Enable Smart Search
            </button>
            {error && <p className="text-sm text-error">{error}</p>}
          </div>
        )}

        {status === "indexing" && (
          <div className="rounded-xl bg-surface-container-low p-6 flex flex-col gap-3">
            {!modelReady ? (
              <>
                <p className="text-body-md text-on-surface">Downloading the search model…</p>
                <div className="h-2 w-full rounded-full bg-surface-variant overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.round(modelProgress * 100)}%` }}
                  />
                </div>
              </>
            ) : (
              <>
                <p className="text-body-md text-on-surface">
                  Indexing your entries — {indexedCount} of {totalCount}
                </p>
                <div className="h-2 w-full rounded-full bg-surface-variant overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${totalCount ? Math.round((indexedCount / totalCount) * 100) : 0}%` }}
                  />
                </div>
              </>
            )}
            <p className="text-label-sm text-outline">
              This only happens once — new entries are indexed automatically after that.
            </p>
          </div>
        )}

        {status === "ready" && (
          <>
            <div className="mb-stack-gap">
              <div className="relative flex items-center w-full h-12 rounded-full bg-surface-container-low border border-outline-variant/30 focus-within:border-primary/50 focus-within:bg-surface transition-colors overflow-hidden">
                <div className="grid place-items-center h-full w-12 text-outline">
                  <MaterialIcon name="travel_explore" size={20} />
                </div>
                <input
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  placeholder="Search by meaning — e.g. “feeling anxious about money”"
                  autoFocus
                  className="peer h-full w-full outline-none text-body-md text-on-surface bg-transparent pr-4 placeholder:text-outline-variant"
                />
              </div>
            </div>

            {indexedCount < totalCount && (
              <p className="text-label-sm text-outline mb-4">
                Indexing new entries in the background ({indexedCount}/{totalCount})…
              </p>
            )}

            {!query.trim() && (
              <p className="text-body-md text-outline-variant text-center pt-8">
                Try describing a feeling, a place, or a moment — not just the exact words.
              </p>
            )}

            {searching && <p className="text-sm text-on-surface-variant">Searching…</p>}

            {!searching && query.trim() && results?.length === 0 && (
              <p className="text-body-md text-outline-variant text-center pt-8">
                No entries feel close to that yet.
              </p>
            )}

            {!searching && query.trim() && results && results.length > 0 && (
              <div className="flex flex-col gap-inline-gap">
                {results.map((r) => {
                  const entry = entryById.get(r.id);
                  if (!entry) return null;
                  const snippet = decrypted[entry.id];
                  const moodLabel = entry.mood_score ? MOOD_LABEL[entry.mood_score] : null;
                  return (
                    <Link
                      key={r.id}
                      href={`/journal/${r.id}`}
                      className="block p-6 rounded-xl bg-surface-container-low border border-transparent transition-all hover:shadow-[0_4px_20px_-4px_rgba(74,101,78,0.1)] hover:border-surface-variant"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <time className="text-label-sm text-outline">{formatDay(entry.created_at)}</time>
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
            )}

            <button
              type="button"
              onClick={disable}
              className="mt-stack-gap w-full text-center text-label-sm text-outline hover:text-error transition-colors py-2"
            >
              Turn off Smart Search and clear the index
            </button>
          </>
        )}
      </main>

      <BottomTabBar />
    </div>
  );
}
