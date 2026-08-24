"use client";

/**
 * Client-side cache for AI-generated playback narratives — see
 * docs/ARCHITECTURE.md §10.2 (playback narrative) and §10.5 step 4.
 *
 * Same posture as src/lib/search/vectorStore.ts, for the same reason:
 * this is AI output derived from decrypted entry plaintext (§5, point 2 —
 * "AI-generated output derived from plaintext is itself sensitive... it
 * does not get a free pass just because the AI produced it rather than
 * the user"), and it's arguably MORE sensitive than a search embedding —
 * `PlaybackNarrative.highlightQuote` is a verbatim quote lifted from an
 * entry, not an abstract vector. Stored AES-GCM-encrypted with the DEK,
 * never in the clear, one IndexedDB database per Clerk user.
 *
 * Entries have no update path (only DELETE — see src/app/api/entries/[id]/
 * route.ts), so a cache key built from the sorted set of entry ids is
 * stable with no need for an updated_at/content-hash component.
 */

const STORE_NAME = "narratives";

export interface StoredNarrative {
  ciphertext: string;
  iv: string;
}

function dbName(userId: string): string {
  return `nook-playback-${userId}`;
}

function openDb(userId: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName(userId), 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Cache key from (period, tone, sorted entry ids) — not the entry text
 * itself, which never needs to touch this module. Hashed to keep the
 * IndexedDB key short and independent of entry count.
 */
export async function buildNarrativeCacheKey(
  period: string,
  tone: string,
  entryIds: string[],
): Promise<string> {
  const canonical = `${period}:${tone}:${[...entryIds].sort().join(",")}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getCachedNarrative(
  userId: string,
  key: string,
): Promise<StoredNarrative | undefined> {
  const db = await openDb(userId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result as StoredNarrative | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function putCachedNarrative(
  userId: string,
  key: string,
  value: StoredNarrative,
): Promise<void> {
  const db = await openDb(userId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
