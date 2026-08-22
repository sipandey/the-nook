"use client";

import { useEffect, useState } from "react";
import { decryptText } from "@/lib/crypto";

export interface Ciphertext {
  id: string;
  ciphertext: string;
  iv: string;
}

/**
 * Generic client-side batch decrypt, shared by entries and manifestations —
 * both are (encrypted, iv) rows keyed by id with a DEK that's only ever in
 * memory (see docs/ARCHITECTURE.md §5). Screens using this live inside
 * src/app/(app)/, which UnlockGate already guarantees means the DEK is
 * present by render time.
 *
 * Returns a map of id -> plaintext. A missing key means "still decrypting,"
 * an empty string means "decryption failed" — callers should tell those
 * two apart rather than treating both as loading.
 */
export function useDecryptedMap(items: Ciphertext[] | undefined, dek: CryptoKey | null) {
  const [decrypted, setDecrypted] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!items || !dek) return;
    let cancelled = false;

    Promise.all(
      items.map(async (item) => {
        try {
          const text = await decryptText({ ciphertext: item.ciphertext, iv: item.iv }, dek);
          return [item.id, text] as const;
        } catch {
          return [item.id, ""] as const;
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
    // Re-run when the *set* of ids changes, not on every array identity
    // change — a fresh array with the same rows shouldn't re-decrypt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items?.map((i) => i.id).join(","), dek]);

  return decrypted;
}
