"use client";

/**
 * IndexedDB persistence for the entry composer's in-progress draft — see
 * docs/ROADMAP.md NK-01. Same posture as src/lib/playback/narrativeCache.ts
 * and src/lib/search/vectorStore.ts: AES-GCM-encrypted with the DEK before
 * it ever touches disk, one database per Clerk user, never the clear text.
 *
 * A draft is arguably the MOST sensitive thing this pattern protects —
 * unlike a cached narrative or a search vector (both derived from
 * plaintext), a draft *is* plaintext, verbatim, mid-composition.
 *
 * One draft slot per user, not one per entry — the composer only ever
 * has a single in-progress entry at a time, so there's nothing to key by.
 */

const STORE_NAME = "draft";
const DRAFT_KEY = "current";

export interface StoredDraft {
  ciphertext: string;
  iv: string;
}

function dbName(userId: string): string {
  return `nook-composer-${userId}`;
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

export async function getStoredDraft(userId: string): Promise<StoredDraft | undefined> {
  const db = await openDb(userId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(DRAFT_KEY);
    req.onsuccess = () => resolve(req.result as StoredDraft | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function putStoredDraft(userId: string, value: StoredDraft): Promise<void> {
  const db = await openDb(userId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, DRAFT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearStoredDraft(userId: string): Promise<void> {
  const db = await openDb(userId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(DRAFT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
