"use client";

import { useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { resolveAiEnabled } from "@/lib/aiPrivacy";

/** Reads/writes the AI-features-on/off switch via Clerk's
 *  user.unsafeMetadata — same mechanism and same reasoning as
 *  src/lib/hooks/useTone.ts (a UI/behavior preference, not sensitive
 *  content, so it doesn't need the encryption model at all). See
 *  docs/plans/2026-08-25-ai-privacy-controls-design.md. */
export function useAiEnabled() {
  const { user, isLoaded } = useUser();
  const aiEnabled = resolveAiEnabled(user?.unsafeMetadata);

  const setAiEnabled = useCallback(
    async (next: boolean) => {
      if (!user) return;
      await user.update({ unsafeMetadata: { ...user.unsafeMetadata, aiEnabled: next } });
    },
    [user],
  );

  return { aiEnabled, setAiEnabled, isLoaded };
}
