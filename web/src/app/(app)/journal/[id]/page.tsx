"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center bg-background">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-2 bg-background px-6 text-center">
        <p className="text-sm text-muted">Couldn&rsquo;t find that entry.</p>
        <Link href="/journal" className="text-sm font-semibold text-accent">
          Back to journal
        </Link>
      </div>
    );
  }

  const fullDate = new Date(entry.created_at).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const shortDate = new Date(entry.created_at).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const body = decrypted[entry.id];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-divider px-3.5 pt-3.5 pb-2.5">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-7 w-7 items-center justify-center"
        >
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M12.5 4.5L6.5 10l6 5.5" />
          </svg>
        </button>
        <span className="text-xs font-semibold text-muted">{shortDate}</span>
        <button
          type="button"
          onClick={() => setConfirmingDelete((v) => !v)}
          aria-label="More options"
          className="flex h-7 w-7 items-center justify-center"
        >
          <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" strokeLinecap="round">
            <circle cx="4" cy="10" r="1.1" />
            <circle cx="10" cy="10" r="1.1" />
            <circle cx="16" cy="10" r="1.1" />
          </svg>
        </button>
      </div>

      {confirmingDelete && (
        <div className="flex items-center justify-between gap-3 border-b border-warn-soft bg-warn-soft px-4 py-2.5">
          <span className="text-xs text-warn">Delete this entry? This can&rsquo;t be undone.</span>
          <div className="flex flex-shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="text-xs font-semibold text-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteEntry.isPending}
              className="text-xs font-semibold text-warn"
            >
              {deleteEntry.isPending ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3.5 px-4 pt-5 pb-4">
        <div>
          <h1 className="text-lg font-bold">{fullDate}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {entry.mood_score && (
              <span className="flex items-center gap-1 rounded-full border border-accent px-2.5 py-0.5 text-[10px] text-accent">
                <svg viewBox="0 0 20 20" width="8" height="8" fill="currentColor">
                  <circle cx="10" cy="10" r="8" />
                </svg>
                {MOOD_WORD[entry.mood_score] ?? entry.mood_score}
              </span>
            )}
            {entry.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-border px-2.5 py-0.5 text-[10px] text-muted">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div
          className="font-serif text-[14.5px] leading-[1.75] whitespace-pre-wrap"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          {body === undefined && "Decrypting…"}
          {body === "" && "This entry couldn't be decrypted with your current key."}
          {body}
        </div>

        {memoryEntry && (
          <Link
            href={`/journal/${memoryEntry.id}`}
            className="flex items-start gap-2 border-t border-dashed border-border pt-3 text-xs text-muted"
          >
            <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" className="mt-0.5 flex-shrink-0">
              <circle cx="10" cy="10" r="7.5" />
              <path d="M10 6v4l3 2" />
            </svg>
            <span>
              <b className="text-foreground">
                {new Date(memoryEntry.created_at).getFullYear()} — one year ago today.
              </b>{" "}
              {decrypted[memoryEntry.id] ? `"${decrypted[memoryEntry.id].slice(0, 80)}…"` : "Worth a look."}
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}
