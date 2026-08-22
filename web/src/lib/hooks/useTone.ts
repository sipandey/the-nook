"use client";

import { useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { DEFAULT_TONE, type Tone } from "@/lib/tone";

/** Reads/writes tone via Clerk's user.unsafeMetadata — see the note in
 *  src/lib/tone.ts for why it lives there instead of Supabase. */
export function useTone() {
  const { user, isLoaded } = useUser();
  const tone = (user?.unsafeMetadata?.tone as Tone | undefined) ?? DEFAULT_TONE;

  const setTone = useCallback(
    async (next: Tone) => {
      if (!user) return;
      await user.update({ unsafeMetadata: { ...user.unsafeMetadata, tone: next } });
    },
    [user],
  );

  return { tone, setTone, isLoaded };
}
