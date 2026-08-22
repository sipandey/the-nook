"use client";

import { useMutation } from "@tanstack/react-query";
import type { Period } from "@/lib/period";
import type { PlaybackNarrative } from "@/lib/ai/openai";

export interface PlaybackRequest {
  period: Period;
  entryPlaintexts: { date: string; text: string; mood: number }[];
}

/** Tone is hardcoded to "friend" for the same reason as /api/ai/prompt —
 *  there's nowhere to read a stored tone preference from yet. */
export function usePlaybackNarrative() {
  return useMutation({
    mutationFn: async (input: PlaybackRequest): Promise<PlaybackNarrative> => {
      const res = await fetch("/api/ai/playback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, tone: "friend" }),
      });
      if (!res.ok) throw new Error("Failed to generate playback");
      return res.json();
    },
  });
}
