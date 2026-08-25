"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { encryptText } from "@/lib/crypto";

export interface AppendToEntryInput {
  entryId: string;
  plaintext: string;
  moodScore: number | null;
  tags: string[];
  dek: CryptoKey;
}

/** Re-encrypts the *combined* plaintext (caller already concatenated the
 *  existing text + the new addition) and PATCHes it in place — see
 *  docs/plans/2026-08-24-append-to-todays-entry-design.md. Same
 *  encrypt-then-send posture as useSaveEntry: plaintext never leaves this
 *  function. */
export function useAppendToEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entryId, plaintext, moodScore, tags, dek }: AppendToEntryInput) => {
      const { ciphertext, iv } = await encryptText(plaintext, dek);

      const res = await fetch(`/api/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encryptedContent: ciphertext,
          iv,
          moodScore,
          tags,
        }),
      });

      if (!res.ok) throw new Error("Failed to append to entry");
      return { id: entryId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
    },
  });
}
