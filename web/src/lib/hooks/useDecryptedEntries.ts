"use client";

import { useEffect, useState } from "react";
import { decryptText } from "@/lib/crypto";
import type { EntryMetadata } from "@/lib/hooks/useEntries";

/**
 * Decrypts a batch of entries' content client-side once the DEK is
 * available. Screens using this live inside src/app/(app)/, which
 * UnlockGate already guarantees means the DEK is in memory by render time —
 * this stays a graceful no-op if that's ever not true.
 *
 * Returns a map of id -> plaintext. A missing key means "still decrypting,"
 * an empty string means "decryption failed" (wrong DEK, corrupted row) —
 * callers should tell those two apart rather than treating both as loading.
 */
export function useDecryptedEntries(
  entries: EntryMetadata[] | undefined,
  dek: CryptoKey | null,
) {
  const [decrypted, setDecrypted] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!entries || !dek) return;
    let cancelled = false;

    Promise.all(
      entries.map(async (e) => {
        try {
          const text = await decryptText({ ciphertext: e.encrypted_content, iv: e.iv }, dek);
          return [e.id, text] as const;
        } catch {
          return [e.id, ""] as const;
        }
      }),
    ).then((pairs) => {
      if (!cancelled) {
        setDecrypted((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
      }
    });

    return () => {
      cancelled = true;
    };
    // Re-run whenever the set of entry ids changes, not on every entries
    // array identity change (a fresh array with the same rows shouldn't
    // re-decrypt everything).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries?.map((e) => e.id).join(","), dek]);

  return decrypted;
}
