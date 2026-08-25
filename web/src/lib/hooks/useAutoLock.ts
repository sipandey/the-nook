"use client";

import { useEffect } from "react";
import { useSessionStore } from "@/lib/store/session";

/** 1 minute — see docs/plans/2026-08-25-auto-lock-design.md's "Decisions"
 *  section for why a grace period, and why this specific length: long
 *  enough that switching away to reply to a text mid-entry doesn't
 *  interrupt writing, short enough that leaving the app backgrounded for
 *  real still re-locks it, not a new Settings toggle to build/maintain. */
const GRACE_PERIOD_MS = 60_000;

/**
 * Re-locks the journal (via useSessionStore's lock()) after the app has
 * spent GRACE_PERIOD_MS continuously hidden. Mounted once from
 * UnlockGate.tsx, which already owns isUnlocked/lock and already gates
 * every (app) screen — when this fires, UnlockGate naturally falls back
 * to the passphrase-unlock screen with no new routing logic needed here.
 *
 * Uses the same document.visibilitychange event useComposerDraft.ts
 * already relies on for its own flush-on-background behavior — a proven
 * mechanism in this exact app, not a new one. The two listeners don't
 * race: the draft flush completes in well under a second, 59+ seconds
 * before this hook's timer could ever fire.
 *
 * No-ops entirely while already locked — nothing to register, no timer
 * to run, so there's no cost to mounting this unconditionally.
 */
export function useAutoLock() {
  const isUnlocked = useSessionStore((s) => s.isUnlocked);
  const lock = useSessionStore((s) => s.lock);

  useEffect(() => {
    if (!isUnlocked) return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        timeoutId = setTimeout(() => {
          lock();
        }, GRACE_PERIOD_MS);
      } else if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isUnlocked, lock]);
}
