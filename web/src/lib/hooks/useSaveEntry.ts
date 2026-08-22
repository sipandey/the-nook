"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { encryptText } from "@/lib/crypto";

export interface SaveEntryInput {
  plaintext: string;
  moodScore: number | null;
  tags: string[];
  dek: CryptoKey;
}

/** Encrypts client-side with the DEK, then POSTs only ciphertext — see
 *  docs/ARCHITECTURE.md §6.3. The plaintext never leaves this function. */
export function useSaveEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ plaintext, moodScore, tags, dek }: SaveEntryInput) => {
      const { ciphertext, iv } = await encryptText(plaintext, dek);

      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encryptedContent: ciphertext,
          iv,
          moodScore,
          tags,
        }),
      });

      if (!res.ok) throw new Error("Failed to save entry");
      return res.json() as Promise<{ id: string; created_at: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
    },
  });
}
