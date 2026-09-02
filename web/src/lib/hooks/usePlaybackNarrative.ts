"use client";

import { useMutation } from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";
import type { Period } from "@/lib/period";
import type { PlaybackNarrative } from "@/lib/ai/openai";
import type { Tone } from "@/lib/tone";
import { PREVIEW_MODE, getPreviewPlaybackNarrative } from "@/lib/preview";
import { decryptText, encryptText } from "@/lib/crypto";
import { useSessionStore } from "@/lib/store/session";
import {
  buildNarrativeCacheKey,
  getCachedNarrative,
  putCachedNarrative,
  type NarrativeCacheEntryRef,
} from "@/lib/playback/narrativeCache";

export interface PlaybackRequest {
  period: Period;
  tone: Tone;
  entryPlaintexts: { date: string; text: string; mood: number }[];
  /** Client-side cache-key material only — never sent to the server (the
   *  route doesn't read it; see docs/ARCHITECTURE.md §10.2). Entries have
   *  a real update path now (appending), so updated_at rides along with
   *  each id — see src/lib/playback/narrativeCache.ts. */
  entries: NarrativeCacheEntryRef[];
}

/**
 * Generates (or serves a cached copy of) the playback narrative for a
 * period. Caching is entirely client-side and entirely optional to the
 * request/response shape the API expects — see
 * src/lib/playback/narrativeCache.ts for why this is encrypted at rest,
 * same as the semantic-search vector cache.
 */
export function usePlaybackNarrative() {
  const { user } = useUser();
  const userId = user?.id;
  const dek = useSessionStore((s) => s.dek);

  // Caching is entirely client-side, so preview mode (see
  // src/lib/preview.ts) can exercise the real cache/decrypt/encrypt path
  // around its fixture narrative instead of bypassing it — same reasoning
  // as useSemanticSearch's preview-mode userId.
  const cacheUserId = PREVIEW_MODE ? "preview-user" : userId;

  return useMutation({
    mutationFn: async (input: PlaybackRequest): Promise<PlaybackNarrative> => {
      if (cacheUserId && dek) {
        const key = await buildNarrativeCacheKey(input.period, input.tone, input.entries);
        const cached = await getCachedNarrative(cacheUserId, key);
        if (cached) {
          try {
            const json = await decryptText({ ciphertext: cached.ciphertext, iv: cached.iv }, dek);
            return JSON.parse(json) as PlaybackNarrative;
          } catch {
            // Fall through and regenerate — a corrupt/undecryptable cache
            // entry shouldn't block the feature, just miss silently.
          }
        }
      }

      const narrative = PREVIEW_MODE
        ? getPreviewPlaybackNarrative()
        : await (async () => {
            const res = await fetch("/api/ai/playback", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(input),
            });
            if (!res.ok) {
              // Preserve the route's specific error code (e.g.
              // "spend_ceiling_reached" — NK-13) as the thrown Error's
              // message, so the UI can tell "AI features are paused for
              // today" apart from a generic failure, instead of a single
              // undifferentiated error state for both.
              const body = await res.json().catch(() => null);
              throw new Error(body?.error ?? "Failed to generate playback");
            }
            return (await res.json()) as PlaybackNarrative;
          })();

      if (cacheUserId && dek) {
        try {
          const key = await buildNarrativeCacheKey(input.period, input.tone, input.entries);
          const { ciphertext, iv } = await encryptText(JSON.stringify(narrative), dek);
          await putCachedNarrative(cacheUserId, key, { ciphertext, iv });
        } catch {
          // Caching is a bonus, not a requirement — the narrative was
          // already generated successfully; don't fail the request over
          // a storage error.
        }
      }

      return narrative;
    },
  });
}
