"use client";

/**
 * IndexedDB store for cached entry embeddings — see
 * docs/ARCHITECTURE.md §10.3/§10.6.6.
 *
 * Vectors are stored ENCRYPTED (AES-GCM with the DEK, same primitive as
 * entry content in src/lib/crypto) — this is non-negotiable, not an
 * optional hardening step. Everywhere else in the app, nothing derived
 * from plaintext survives a reload without the passphrase (the DEK is
 * memory-only, §6.2). An unencrypted vector cache would be the one
 * exception: a persistent, on-disk artifact readable by anything with
 * local storage access, without ever needing the passphrase. Encrypting
 * it keeps that invariant intact even though the DB itself is local-only
 * and never touches the network.
 *
 * One database per Clerk user (`nook-vectors-${userId}`) so a shared
 * browser doesn't mix state across accounts, even though cross-account
 * decryption would fail anyway (each account's vectors are under its own
 * DEK).
 */

const STORE_NAME = "vectors";

export interface StoredVector {
  id: string; // entry id
  ciphertext: string;
  iv: string;
}

function dbName(userId: string): string {
  return `nook-vectors-${userId}`;
}

function openDb(userId: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName(userId), 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getIndexedIds(userId: string): Promise<Set<string>> {
  const db = await openDb(userId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAllKeys();
    req.onsuccess = () => resolve(new Set(req.result as string[]));
    req.onerror = () => reject(req.error);
  });
}

export async function getAllVectors(userId: string): Promise<StoredVector[]> {
  const db = await openDb(userId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as StoredVector[]);
    req.onerror = () => reject(req.error);
  });
}

export async function putVector(userId: string, vector: StoredVector): Promise<void> {
  const db = await openDb(userId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(vector);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Drops every cached vector for this user — used when disabling smart
 * search or rebuilding the index from scratch. Deliberately does not
 * prune vectors for individually deleted entries as entries are removed
 * (§10.6's "accepted simplification" — a stray cached vector for a
 * since-deleted entry is inert: search results are always intersected
 * with the live entries list before being shown, so it can never surface,
 * it just sits unused until the next full clear).
 */
export async function clearVectors(userId: string): Promise<void> {
  const db = await openDb(userId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
