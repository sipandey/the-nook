"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/MaterialIcon";
import { useEntries } from "@/lib/hooks/useEntries";
import { useDecryptedEntries } from "@/lib/hooks/useDecryptedEntries";
import { useDeleteEntry } from "@/lib/hooks/useDeleteEntry";
import { useSessionStore } from "@/lib/store/session";

const MOOD_WORD: Record<number, string> = {
  1: "Struggling",
  2: "Low",
  3: "Steady",
  4: "Good",
  5: "Great",
};

export default function EntryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: entries, isLoading } = useEntries();
  const dek = useSessionStore((s) => s.dek);
  const deleteEntry = useDeleteEntry();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const entry = useMemo(() => entries?.find((e) => e.id === id), [entries, id]);

  // "One year ago today" — same month/day as this entry, an earlier year.
  const memoryEntry = useMemo(() => {
    if (!entry) return undefined;
    const thisDate = new Date(entry.created_at);
    return entries?.find((e) => {
      if (e.id === entry.id) return false;
      const d = new Date(e.created_at);
      return (
        d.getMonth() === thisDate.getMonth() &&
        d.getDate() === thisDate.getDate() &&
        d.getFullYear() < thisDate.getFullYear()
      );
    });
  }, [entries, entry]);

  const toDecrypt = useMemo(
    () => [entry, memoryEntry].filter((e): e is NonNullable<typeof e> => Boolean(e)),
    [entry, memoryEntry],
  );
  const decrypted = useDecryptedEntries(toDecrypt, dek);

  async function handleDelete() {
    await deleteEntry.mutateAsync(id);
    router.push("/journal");
  }

  if (isLoading) {
    return (
      <div className="font-editorial-sans mx-auto flex min-h-screen w-full max-w-md items-center justify-center bg-background text-on-surface-variant">
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="font-editorial-sans mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-2 bg-background px-6 text-center text-on-background">
        <p className="text-sm text-on-surface-variant">Couldn&rsquo;t find that entry.</p>
        <Link href="/journal" className="text-sm font-semibold text-primary">
          Back to journal
        </Link>
      </div>
    );
  }

  const fullDate = new Date(entry.created_at).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const shortDate = new Date(entry.created_at).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const body = decrypted[entry.id];

  return (
    <div className="font-editorial-sans bg-background text-on-background min-h-screen pb-stack-gap">
      <header className="flex justify-between items-center w-full px-container-padding py-4 bg-background sticky top-0 z-10">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="text-primary hover:bg-surface-container-low transition-colors p-2 rounded-full"
        >
          <MaterialIcon name="arrow_back" />
        </button>
        <span className="text-label-sm text-outline uppercase tracking-wider">{shortDate}</span>
        <button
          type="button"
          onClick={() => setConfirmingDelete((v) => !v)}
          aria-label="More actions"
          className="text-primary hover:bg-surface-container-low transition-colors p-2 rounded-full"
        >
          <MaterialIcon name="more_vert" />
        </button>
      </header>

      <main className="px-container-padding pt-stack-gap max-w-2xl mx-auto">
        <article>
          <header className="mb-stack-gap text-center">
            <time className="text-label-sm text-outline tracking-widest uppercase block mb-4">{fullDate}</time>
          </header>

          <div className="font-editorial-display text-body-lg text-on-surface-variant leading-relaxed whitespace-pre-wrap">
            {body === undefined && "Decrypting…"}
            {body === "" && "This entry couldn't be decrypted with your current key."}
            {body}
          </div>

          {(entry.mood_score || entry.tags.length > 0) && (
            <div className="mt-stack-gap pt-stack-gap border-t border-surface-variant flex flex-wrap gap-inline-gap items-center">
              {entry.tags.length > 0 && <div className="text-label-sm text-outline mr-2">Filed under:</div>}
              {entry.tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-surface-container text-on-surface-variant text-label-sm px-4 py-1.5 rounded-full border border-surface-dim"
                >
                  #{tag}
                </span>
              ))}
              {entry.mood_score && (
                <span className="bg-primary-fixed-dim text-on-primary-fixed-variant text-label-sm px-4 py-1.5 rounded-full border border-primary-container ml-auto flex items-center gap-1 shadow-sm">
                  <MaterialIcon name="water_drop" filled size={16} />
                  {MOOD_WORD[entry.mood_score] ?? entry.mood_score}
                </span>
              )}
            </div>
          )}
        </article>

        {confirmingDelete && (
          <div className="my-8 p-6 bg-error-container rounded-xl border border-error/20 flex flex-col items-center text-center">
            <MaterialIcon name="warning" className="text-error mb-4" size={30} />
            <h3 className="font-editorial-display text-headline-md text-on-error-container mb-2">
              Are you sure you want to delete this thought?
            </h3>
            <p className="text-body-md text-on-error-container/80 mb-6">This action cannot be undone.</p>
            <div className="flex flex-col w-full gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="px-6 py-3 rounded-full bg-surface-container-lowest text-on-surface border border-outline-variant text-label-sm hover:bg-surface-container-low transition-colors"
              >
                Keep Entry
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteEntry.isPending}
                className="px-6 py-3 rounded-full bg-error text-on-error text-label-sm hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50"
              >
                {deleteEntry.isPending ? "Deleting…" : "Delete Permanently"}
              </button>
            </div>
          </div>
        )}

        {memoryEntry && (
          <section className="mt-stack-gap bg-surface-container-low border border-surface-dim rounded-xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-primary pointer-events-none">
              <MaterialIcon name="history" size={56} />
            </div>
            <div className="flex items-center gap-2 mb-4">
              <MaterialIcon name="auto_awesome" className="text-primary" size={20} />
              <h2 className="text-label-sm text-primary tracking-widest uppercase">On This Day</h2>
            </div>
            <p className="text-body-lg text-on-surface-variant italic mb-2">
              {new Date(memoryEntry.created_at).getFullYear()}, you were reflecting on…
            </p>
            <div className="pl-4 border-l-2 border-primary-container font-editorial-display text-headline-md text-on-background opacity-80">
              {decrypted[memoryEntry.id] ? `${decrypted[memoryEntry.id].slice(0, 140)}…` : "Worth a look."}
            </div>
            <Link
              href={`/journal/${memoryEntry.id}`}
              className="mt-4 text-label-sm text-primary hover:text-primary-fixed-dim transition-colors flex items-center gap-1"
            >
              Read the full entry
              <MaterialIcon name="arrow_forward" size={16} />
            </Link>
          </section>
        )}

        <footer className="mt-stack-gap pt-inline-gap flex justify-center items-center text-outline gap-1">
          <MaterialIcon name="lock" size={14} />
          <span className="text-[11px] uppercase tracking-widest">End-to-End Encrypted</span>
        </footer>
      </main>
    </div>
  );
}
