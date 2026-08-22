"use client";

import { useEffect, type ReactNode } from "react";
import { useUser } from "@clerk/nextjs";
import { useSessionStore } from "@/lib/store/session";
import { useKeyMaterial } from "@/lib/hooks/useKeyMaterial";
import { PREVIEW_MODE, getPreviewDek } from "@/lib/preview";
import { PassphraseSetup } from "./PassphraseSetup";
import { PassphraseUnlock } from "./PassphraseUnlock";

/**
 * Gates every screen in src/app/(app)/ behind having the DEK in memory.
 * Clerk auth is already enforced by src/proxy.ts before any of this runs —
 * this is the second, independent gate: proving you know the journal
 * passphrase, not just who you are. See docs/ARCHITECTURE.md §5.
 */
export function UnlockGate({ children }: { children: ReactNode }) {
  const { isLoaded: clerkLoaded } = useUser();
  const isUnlocked = useSessionStore((s) => s.isUnlocked);
  const unlock = useSessionStore((s) => s.unlock);
  const { data: keyMaterial, isLoading: keysLoading, error } = useKeyMaterial();

  useEffect(() => {
    if (PREVIEW_MODE && !isUnlocked) {
      getPreviewDek().then(unlock);
    }
  }, [isUnlocked, unlock]);

  if (isUnlocked) return <>{children}</>;

  if (PREVIEW_MODE) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <p className="text-sm text-muted">Loading preview…</p>
      </div>
    );
  }

  if (!clerkLoaded || keysLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background px-6 text-center">
        <p className="text-sm text-warn">
          Couldn&rsquo;t reach your journal. Check your connection and reload.
        </p>
      </div>
    );
  }

  if (!keyMaterial) return <PassphraseSetup />;

  return <PassphraseUnlock keyMaterial={keyMaterial} />;
}
