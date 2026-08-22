"use client";

import { useMutation } from "@tanstack/react-query";
import type { Period } from "@/lib/period";
import type { PlaybackNarrative } from "@/lib/ai/openai";
import type { Tone } from "@/lib/tone";

export interface PlaybackRequest {
  period: Period;
  tone: Tone;
  entryPlaintexts: { date: string; text: string; mood: number }[];
}

export function usePlaybackNarrative() {
  return useMutation({
    mutationFn: async (input: PlaybackRequest): Promise<PlaybackNarrative> => {
      const res = await fetch("/api/ai/playback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to generate playback");
      return res.json();
    },
  });
}
