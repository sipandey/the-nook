"use client";

import { useMemo } from "react";
import { useDecryptedMap } from "@/lib/hooks/useDecryptedMap";
import type { EntryMetadata } from "@/lib/hooks/useEntries";

/** Entry-flavored wrapper over the generic decrypt hook — see
 *  useDecryptedMap.ts for the shared logic and DEK-availability note. */
export function useDecryptedEntries(
  entries: EntryMetadata[] | undefined,
  dek: CryptoKey | null,
) {
  const items = useMemo(
    () => entries?.map((e) => ({ id: e.id, ciphertext: e.encrypted_content, iv: e.iv })),
    [entries],
  );
  return useDecryptedMap(items, dek);
}
