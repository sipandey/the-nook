"use client";

import { useQuery } from "@tanstack/react-query";

export interface EntryMetadata {
  id: string;
  created_at: string;
  mood_score: number | null;
  tags: string[];
  /**
   * Still ciphertext at this point — decrypting requires the DEK from
   * useSessionStore(), which isn't populated until the journal-passphrase
   * unlock flow exists (see docs/ARCHITECTURE.md §6.2). Until then, callers
   * should treat these as opaque and show a locked state.
   */
  encrypted_content: string;
  iv: string;
}

/** Fetches the signed-in user's entries via the Route Handler (which reads
 *  the Clerk session cookie server-side — see src/app/api/entries/route.ts).
 *  No Supabase credentials touch the client for this call. */
export function useEntries() {
  return useQuery({
    queryKey: ["entries"],
    queryFn: async (): Promise<EntryMetadata[]> => {
      const res = await fetch("/api/entries");
      if (!res.ok) throw new Error("Failed to load entries");
      return res.json();
    },
  });
}
