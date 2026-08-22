"use client";

import { useState } from "react";
import { HillsHero } from "@/components/HillsHero";
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
      const dek = await unwrapDataEncryptionKey(material, secret.trim());
      unlock(dek);
    } catch {
      // AES-GCM auth-tag failure is the only realistic cause here — treat
      // it as "wrong secret," never inspect or surface the raw error.
      setError(
        mode === "recovery" ? "That recovery code doesn't match." : "That passphrase doesn't match.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === "sync") {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
        <HillsHero height={60} sunSide="center" />
        <div className="flex flex-1 flex-col justify-center gap-4 px-5 pb-6">
          <div className="text-center">
            <h1 className="text-lg font-bold leading-snug">Sync from another device</h1>
          </div>
          <DeviceSyncPanel onBack={() => setMode("passphrase")} />
        </div>
      </div>
    );
  }

  const usingRecovery = mode === "recovery";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <HillsHero height={60} sunSide="center" />

      <div className="flex flex-1 flex-col gap-4 px-5 pt-6 pb-4">
        <div>
          <h1 className="text-lg font-bold leading-snug">
            {usingRecovery ? "Enter your recovery code" : "Unlock your journal"}
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            {usingRecovery
              ? "Enter the recovery code you saved when you first set up your journal."
              : "Enter your journal passphrase to decrypt your entries on this device."}
          </p>
        </div>

        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">
            {usingRecovery ? "Recovery code" : "Journal passphrase"}
          </label>
          <input
            type={usingRecovery ? "text" : "password"}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && secret && !submitting && submit()}
            placeholder={usingRecovery ? "XKPQ-7RTN-4LWD-9VCM" : undefined}
            className="w-full rounded-[9px] border-[1.3px] border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
            autoFocus
          />
        </div>

        {error && <p className="text-xs text-warn">{error}</p>}

        <div className="flex flex-col items-start gap-2">
          <button
            type="button"
            onClick={() => {
              setMode(usingRecovery ? "passphrase" : "recovery");
              setSecret("");
              setError(null);
            }}
            className="text-[11.5px] font-semibold text-accent"
          >
            {usingRecovery ? "Use my passphrase instead" : "Forgot your passphrase?"}
          </button>
          {!usingRecovery && (
            <button
              type="button"
              onClick={() => {
                setMode("sync");
                setError(null);
              }}
              className="text-[11.5px] font-semibold text-accent"
            >
              Sync from another device instead
            </button>
          )}
        </div>

        <div className="flex-1" />

        <button
          type="button"
          disabled={!secret || submitting}
          onClick={submit}
          className="rounded-[10px] bg-accent px-4 py-3 text-[13px] font-semibold text-white disabled:opacity-40"
        >
          {submitting ? "Unlocking…" : "Unlock"}
        </button>
      </div>
    </div>
  );
}
