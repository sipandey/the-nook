"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { HillsHero } from "@/components/HillsHero";
import { useSessionStore } from "@/lib/store/session";
import {
  generateDataEncryptionKey,
  generateRecoveryCode,
  wrapDataEncryptionKey,
} from "@/lib/crypto";

const MIN_LENGTH = 10;

type Step = "passphrase" | "recovery";

export function PassphraseSetup() {
  const [step, setStep] = useState<Step>("passphrase");
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [recoveryCode] = useState(() => generateRecoveryCode());
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unlock = useSessionStore((s) => s.unlock);
  const queryClient = useQueryClient();

  const passphraseError =
    passphrase.length > 0 && passphrase.length < MIN_LENGTH
      ? `At least ${MIN_LENGTH} characters`
      : confirm.length > 0 && confirm !== passphrase
        ? "Doesn't match"
        : null;

  const canContinue = passphrase.length >= MIN_LENGTH && passphrase === confirm;

  async function finish() {
    setSubmitting(true);
    setError(null);
    try {
      const dek = await generateDataEncryptionKey();
      const passphraseWrap = await wrapDataEncryptionKey(dek, passphrase);
      const recoveryWrap = await wrapDataEncryptionKey(dek, recoveryCode);

      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wrappedDek: passphraseWrap.wrappedKey,
          wrappedDekIv: passphraseWrap.iv,
          wrappedDekSalt: passphraseWrap.salt,
          wrappedDekRecovery: recoveryWrap.wrappedKey,
          wrappedDekRecoveryIv: recoveryWrap.iv,
          wrappedDekRecoverySalt: recoveryWrap.salt,
        }),
      });

      if (!res.ok) throw new Error("Couldn't save your key. Try again.");

      unlock(dek);
      await queryClient.invalidateQueries({ queryKey: ["keyMaterial"] });
    } catch {
      setError("Something went wrong saving your journal key. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <HillsHero height={60} sunSide={step === "passphrase" ? "center" : "center"} />

      {step === "passphrase" && (
        <div className="flex flex-1 flex-col gap-4 px-5 pt-6 pb-4">
          <div>
            <h1 className="text-lg font-bold leading-snug">
              Set your journal passphrase
            </h1>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              This is different from your account password. It&rsquo;s the
              only thing that unlocks your entries — we never see it, and
              it&rsquo;s not stored anywhere we can read.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">
                Journal passphrase
              </label>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full rounded-[9px] border-[1.3px] border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">
                Confirm passphrase
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-[9px] border-[1.3px] border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </div>
            {passphraseError && (
              <p className="text-xs text-warn">{passphraseError}</p>
            )}
          </div>

          <div className="flex gap-2 rounded-[9px] bg-accent-soft/60 p-3 text-[10.5px] leading-relaxed text-muted">
            Your account password gets you signed in. This passphrase unlocks
            your entries. We can&rsquo;t reset either for you —{" "}
            <b className="text-foreground">you&rsquo;ll get a recovery code next.</b>
          </div>

          <div className="flex-1" />

          <button
            type="button"
            disabled={!canContinue}
            onClick={() => setStep("recovery")}
            className="rounded-[10px] bg-accent px-4 py-3 text-[13px] font-semibold text-white disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      )}

      {step === "recovery" && (
        <div className="flex flex-1 flex-col gap-4 px-5 pt-6 pb-4">
          <div>
            <h1 className="text-lg font-bold leading-snug">
              Save your recovery code
            </h1>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              If you ever forget your journal passphrase, this is the only
              way back in. We don&rsquo;t keep a copy.
            </p>
          </div>

          <div className="rounded-[10px] border-[1.3px] border-dashed border-accent bg-accent-soft px-4 py-5 text-center">
            <span className="font-mono text-base font-bold tracking-wide">
              {recoveryCode}
            </span>
          </div>

          <div className="flex gap-2 rounded-[9px] bg-warn-soft p-3 text-[10.5px] leading-relaxed text-warn">
            Losing both your journal passphrase and this code means your
            entries <b>cannot be recovered</b> — by anyone, including us.
          </div>

          <label className="flex items-start gap-2 text-[11.5px]">
            <input
              type="checkbox"
              checked={savedConfirmed}
              onChange={(e) => setSavedConfirmed(e.target.checked)}
              className="mt-0.5 h-[18px] w-[18px] accent-accent"
            />
            I&rsquo;ve saved this somewhere safe, outside this app.
          </label>

          {error && <p className="text-xs text-warn">{error}</p>}

          <div className="flex-1" />

          <button
            type="button"
            disabled={!savedConfirmed || submitting}
            onClick={finish}
            className="rounded-[10px] bg-accent px-4 py-3 text-[13px] font-semibold text-white disabled:opacity-40"
          >
            {submitting ? "Saving…" : "Continue"}
          </button>
        </div>
      )}
    </div>
  );
}
