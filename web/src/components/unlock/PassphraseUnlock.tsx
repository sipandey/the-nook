"use client";

import { useState } from "react";
import { MaterialIcon } from "@/components/MaterialIcon";
import { DeviceSyncPanel } from "@/components/unlock/DeviceSyncPanel";
import { useSessionStore } from "@/lib/store/session";
import { unwrapDataEncryptionKey } from "@/lib/crypto";
import {
  passphraseMaterial,
  recoveryMaterial,
  type KeyMaterialRow,
} from "@/lib/hooks/useKeyMaterial";

type Mode = "passphrase" | "recovery" | "sync";

export function PassphraseUnlock({ keyMaterial }: { keyMaterial: KeyMaterialRow }) {
  const [mode, setMode] = useState<Mode>("passphrase");
  const [secret, setSecret] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unlock = useSessionStore((s) => s.unlock);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const material = mode === "recovery" ? recoveryMaterial(keyMaterial) : passphraseMaterial(keyMaterial);
      // Recovery phrases are space-joined words; normalize whitespace so
      // copy-paste line breaks or double spaces don't cause a false mismatch.
      // The passphrase itself is left untouched — internal spaces there are
      // meaningful, not incidental.
      const normalized = mode === "recovery" ? secret.trim().replace(/\s+/g, " ") : secret.trim();
      const dek = await unwrapDataEncryptionKey(material, normalized);
      unlock(dek);
    } catch {
      // AES-GCM auth-tag failure is the only realistic cause here — treat
      // it as "wrong secret," never inspect or surface the raw error.
      setError(
        mode === "recovery" ? "That recovery phrase doesn't match." : "That passphrase doesn't match.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function switchTo(next: Mode) {
    setMode(next);
    setSecret("");
    setError(null);
  }

  if (mode === "sync") {
    return (
      <div className="font-editorial-sans bg-background text-on-surface min-h-dvh flex flex-col antialiased">
        <main className="flex-1 flex flex-col justify-center items-center px-container-padding py-stack-gap max-w-lg mx-auto w-full">
          <DeviceSyncPanel onBack={() => switchTo("passphrase")} />
        </main>
        <footer className="w-full py-6 flex items-center justify-center gap-2 text-outline">
          <MaterialIcon name="lock_outline" size={16} />
          <span className="text-[10px] uppercase tracking-widest">End-to-End Encrypted</span>
        </footer>
      </div>
    );
  }

  const usingRecovery = mode === "recovery";

  return (
    <div className="font-editorial-sans bg-background text-on-surface min-h-dvh flex flex-col antialiased">
      <main className="flex-1 flex flex-col justify-center items-center px-container-padding py-stack-gap max-w-lg mx-auto w-full text-center">
        <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center mb-stack-gap shadow-[0_10px_30px_-10px_rgba(74,101,78,0.08)]">
          <MaterialIcon name={usingRecovery ? "key" : "lock"} size={28} className={usingRecovery ? "text-secondary" : "text-primary"} />
        </div>
        <h1 className="font-editorial-display text-headline-lg-mobile text-on-surface mb-2">
          {usingRecovery ? "Recovery" : "Sanctuary"}
        </h1>
        <p className="text-body-md text-on-surface-variant mb-stack-gap max-w-xs">
          {usingRecovery
            ? "Enter the 12-word recovery phrase you saved when you first set up your journal."
            : "Your thoughts remain yours alone. Enter your passphrase to continue."}
        </p>

        <div className="w-full mb-stack-gap">
          {usingRecovery ? (
            <textarea
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="ocean velvet prism silent quartz dawn echo lunar timber silver ember bloom"
              rows={3}
              autoFocus
              data-sentry-mask
              className="w-full resize-none bg-transparent border-0 border-b border-outline-variant px-0 py-3 text-center text-body-md text-on-surface focus:ring-0 focus:border-primary placeholder:text-outline-variant transition-colors"
            />
          ) : (
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && secret && !submitting && submit()}
              placeholder="Passphrase"
              autoFocus
              data-sentry-mask
              className="w-full bg-transparent border-0 border-b border-outline-variant px-0 pb-3 text-center text-body-lg text-on-surface focus:ring-0 focus:border-primary placeholder:text-outline-variant transition-colors"
            />
          )}
        </div>

        {error && <p className="text-sm text-error mb-4">{error}</p>}

        <button
          type="button"
          disabled={!secret || submitting}
          onClick={submit}
          className="w-full bg-primary text-on-primary text-label-sm py-4 rounded-full hover:bg-surface-tint transition-all mb-inline-gap shadow-[0_10px_30px_-10px_rgba(74,101,78,0.08)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Unlocking…" : usingRecovery ? "Restore Access" : "Unlock Journal"}
        </button>

        <div className="flex flex-col gap-1 w-full mt-1">
          <button
            type="button"
            onClick={() => switchTo(usingRecovery ? "passphrase" : "recovery")}
            className="text-label-sm text-outline hover:text-primary transition-colors py-2"
          >
            {usingRecovery ? "Return to passphrase" : "Forgot passphrase?"}
          </button>
          {!usingRecovery && (
            <button
              type="button"
              onClick={() => switchTo("sync")}
              className="text-label-sm text-outline hover:text-primary transition-colors py-2"
            >
              Sync from another device
            </button>
          )}
        </div>
      </main>

      <footer className="w-full py-6 flex items-center justify-center gap-2 text-outline">
        <MaterialIcon name="lock_outline" size={16} />
        <span className="text-[10px] uppercase tracking-widest">End-to-End Encrypted</span>
      </footer>
    </div>
  );
}
