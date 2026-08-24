"use client";

import { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { decryptText, encryptText } from "@/lib/crypto";
import { useEntries, type EntryMetadata } from "@/lib/hooks/useEntries";
import { useSessionStore } from "@/lib/store/session";
import { PREVIEW_MODE } from "@/lib/preview";
import { cosineSimilarity } from "@/lib/search/similarity";
import { useEmbeddingWorker } from "@/lib/search/useEmbeddingWorker";
import { clearVectors, getAllVectors, getIndexedIds, putVector } from "@/lib/search/vectorStore";

export type SearchStatus = "checking" | "empty" | "needs-opt-in" | "indexing" | "ready";

export interface SearchResult {
  id: string;
  score: number;
}

/**
 * Orchestrates client-side semantic search — see
 * docs/ARCHITECTURE.md §10.3/§10.4. Indexing (entry → vector) and search
 * (query → ranked entry ids) both decrypt/encrypt on the main thread
 * (where the DEK lives) and only hand already-decrypted plaintext to the
 * embedding worker, which never touches IndexedDB, the DEK, or the
 * network — see embed.worker.ts's header comment.
 */
export function useSemanticSearch() {
  const { user } = useUser();
  // Search is entirely client-side and never touches Clerk or Supabase, so
  // preview mode (see src/lib/preview.ts) can use a fixed local id here to
  // exercise the real worker/IndexedDB/encryption pipeline — unlike other
  // preview-mode fixtures, this isn't standing in for any server capability.
  const userId = PREVIEW_MODE ? "preview-user" : user?.id;
  const dek = useSessionStore((s) => s.dek);
  const { data: entries } = useEntries();
  const { embed, modelProgress, modelReady } = useEmbeddingWorker();

  const [status, setStatus] = useState<SearchStatus>("checking");
  const [indexedCount, setIndexedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const indexEntries = useCallback(
    async (toIndex: EntryMetadata[]) => {
      if (!userId || !dek || toIndex.length === 0) return;
      setStatus("indexing");
      setError(null);
      try {
        for (const entry of toIndex) {
          const text = await decryptText(
            { ciphertext: entry.encrypted_content, iv: entry.iv },
            dek,
          );
          if (!text) continue; // decryption failed — skip rather than index garbage
          const vector = await embed(text);
          const { ciphertext, iv } = await encryptText(JSON.stringify(vector), dek);
          await putVector(userId, { id: entry.id, ciphertext, iv });
          setIndexedCount((c) => c + 1);
        }
        setStatus("ready");
      } catch {
        setError("Couldn't finish indexing. You can try again.");
        setStatus("needs-opt-in");
      }
    },
    [userId, dek, embed],
  );

  // On load (and whenever the entry list changes), figure out where we
  // stand: never opted in, fully indexed, or partially indexed because
  // entries were added since the last visit — the last case re-indexes
  // just the delta silently, since opting in once covers future entries
  // too, not just the ones that existed at opt-in time.
  useEffect(() => {
    if (!userId || !entries) return;
    let cancelled = false;

    getIndexedIds(userId).then((ids) => {
      if (cancelled) return;
      setIndexedCount(ids.size);

      if (entries.length === 0) {
        setStatus("empty");
        return;
      }
      if (ids.size === 0) {
        setStatus("needs-opt-in");
        return;
      }
      setStatus("ready");
      const missing = entries.filter((e) => !ids.has(e.id));
      if (missing.length > 0) void indexEntries(missing);
    });

    return () => {
      cancelled = true;
    };
    // Re-run when the *set* of entry ids changes, not on every refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, entries?.map((e) => e.id).join(",")]);

  const enable = useCallback(() => {
    if (entries) void indexEntries(entries);
  }, [entries, indexEntries]);

  const disable = useCallback(async () => {
    if (!userId) return;
    await clearVectors(userId);
    setIndexedCount(0);
    setStatus(entries?.length ? "needs-opt-in" : "empty");
  }, [userId, entries]);

  const search = useCallback(
    async (query: string): Promise<SearchResult[]> => {
      if (!userId || !dek || !query.trim()) return [];
      const queryVector = await embed(query.trim());
      const stored = await getAllVectors(userId);
      const liveIds = new Set((entries ?? []).map((e) => e.id));

      const scored = await Promise.all(
        stored
          .filter((v) => liveIds.has(v.id))
          .map(async (v) => {
            try {
              const json = await decryptText({ ciphertext: v.ciphertext, iv: v.iv }, dek);
              const vector = JSON.parse(json) as number[];
              return { id: v.id, score: cosineSimilarity(queryVector, vector) };
            } catch {
              return null;
            }
          }),
      );

      return scored
        .filter((s): s is SearchResult => s !== null)
        .sort((a, b) => b.score - a.score);
    },
    [userId, dek, embed, entries],
  );

  return {
    status,
    indexedCount,
    totalCount: entries?.length ?? 0,
    modelProgress,
    modelReady,
    error,
    enable,
    disable,
    search,
  };
}
