"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MaterialIcon } from "@/components/MaterialIcon";
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
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [recoveryCode] = useState(() => generateRecoveryCode());
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
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
  const recoveryWords = recoveryCode.split(" ");

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

  async function copyPhrase() {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied — the words are still selectable on screen.
    }
  }

  if (step === "recovery") {
    return (
      <div className="font-editorial-sans bg-background text-on-background min-h-screen flex flex-col antialiased">
        <main className="flex-grow flex flex-col items-center justify-center px-container-padding py-12 w-full max-w-2xl mx-auto">
          <div className="w-full flex flex-col gap-stack-gap">
            <header className="text-center flex flex-col items-center gap-6">
              <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center border border-outline-variant/30">
                <MaterialIcon name="vpn_key" size={28} className="text-primary" />
              </div>
              <div className="space-y-4 max-w-md mx-auto">
                <h1 className="font-editorial-display text-headline-lg-mobile md:text-display-lg text-on-background">
                  The Master Key
                </h1>
                <p className="text-body-md text-on-surface-variant">
                  This sequence of words is the cryptographic foundation of your sanctuary. It is
                  step 2 of 2 in securing your journal.
                </p>
              </div>
            </header>

            <div className="bg-error-container/80 border border-error/20 p-6 rounded-xl flex items-start gap-4">
              <MaterialIcon name="warning" filled className="text-on-error-container mt-0.5 flex-shrink-0" />
              <p className="text-body-md text-on-error-container leading-relaxed">
                If you lose your passphrase and this code, your journal is gone forever. We
                cannot recover it.
              </p>
            </div>

            <div className="relative bg-surface-container-highest rounded-xl p-6 md:p-8 border border-outline-variant/50">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-6 mb-12">
                {recoveryWords.map((word, i) => (
                  <div key={i} className="flex items-baseline gap-3">
                    <span className="text-label-sm text-outline select-none w-5 text-right">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-mono text-body-md text-on-surface font-medium tracking-wide">
                      {word}
                    </span>
                  </div>
                ))}
              </div>
              <div className="absolute bottom-4 left-0 w-full flex justify-center">
                <button
                  type="button"
                  onClick={copyPhrase}
                  className="bg-surface text-primary border border-primary/20 shadow-sm px-6 py-2.5 rounded-full text-label-sm flex items-center gap-2 hover:bg-surface-container-low hover:border-primary/40 transition-all"
                >
                  <MaterialIcon name={copied ? "check" : "content_copy"} size={18} />
                  <span>{copied ? "Copied to Clipboard" : "Copy Code"}</span>
                </button>
              </div>
            </div>

            <label className="flex items-start gap-4 cursor-pointer bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30">
              <input
                type="checkbox"
                checked={savedConfirmed}
                onChange={(e) => setSavedConfirmed(e.target.checked)}
                className="sr-only peer"
              />
              <span className="mt-0.5 w-6 h-6 flex-shrink-0 rounded border-2 border-outline peer-checked:border-primary peer-checked:bg-primary flex items-center justify-center transition-colors">
                <MaterialIcon name="check" size={14} filled className="text-on-primary" />
              </span>
              <span className="text-body-md text-on-surface select-none">
                I have safely stored this recovery code.
              </span>
            </label>

            {error && <p className="text-sm text-error">{error}</p>}

            <button
              type="button"
              disabled={!savedConfirmed || submitting}
              onClick={finish}
              className="w-full bg-primary text-on-primary text-label-sm py-4 rounded-xl flex items-center justify-center gap-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-tint"
            >
              {submitting ? "Saving…" : "Finish Setup"}
              <MaterialIcon name={submitting ? "lock" : "arrow_forward"} size={18} />
            </button>

            <div className="flex items-center justify-center gap-2 text-outline opacity-60">
              <MaterialIcon name="shield_lock" size={14} />
              <span className="text-label-sm">End-to-End Encrypted</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="font-editorial-sans bg-background text-on-background min-h-screen flex flex-col items-center justify-center p-container-padding antialiased">
      <main className="w-full max-w-md mx-auto flex flex-col gap-stack-gap">
        <header className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-surface-container-low mb-6 text-primary">
            <MaterialIcon name="key" filled size={26} />
          </div>
          <h1 className="font-editorial-display text-headline-lg-mobile md:text-display-lg text-on-surface mb-4">
            Your Private Key
          </h1>
          <p className="text-body-lg text-on-surface-variant max-w-sm mx-auto">
            Create a passphrase to encrypt your journal. This is different from your account
            password; it is the only way to unlock your thoughts.{" "}
            <span className="font-semibold text-error">We cannot reset this for you.</span>
          </p>
        </header>

        <div className="flex flex-col gap-inline-gap">
          <div className="relative">
            <input
              type={showPassphrase ? "text" : "password"}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Passphrase"
              autoFocus
              className="w-full bg-transparent border-0 border-b border-outline-variant px-0 py-4 pr-8 text-body-lg text-on-surface focus:ring-0 focus:border-primary transition-colors"
            />
            <button
              type="button"
              aria-label="Toggle passphrase visibility"
              onClick={() => setShowPassphrase((v) => !v)}
              className="absolute right-0 top-1/2 -translate-y-1/2 text-outline-variant hover:text-primary transition-colors"
            >
              <MaterialIcon name={showPassphrase ? "visibility_off" : "visibility"} size={20} />
            </button>
          </div>

          <input
            type={showPassphrase ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm Passphrase"
            className="w-full bg-transparent border-0 border-b border-outline-variant px-0 py-4 text-body-lg text-on-surface focus:ring-0 focus:border-primary transition-colors"
          />

          {passphraseError && <p className="text-sm text-error">{passphraseError}</p>}

          <div className="flex items-center gap-2 self-start bg-surface-container-low border border-outline-variant/40 px-3 py-1.5 rounded-full mt-1">
            <MaterialIcon name="shield_lock" size={14} filled className="text-privacy-safe" />
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
              Zero-Knowledge
            </span>
          </div>

          <button
            type="button"
            disabled={!canContinue}
            onClick={() => setStep("recovery")}
            className="mt-stack-gap w-full py-4 bg-primary text-on-primary rounded-xl text-label-sm uppercase tracking-wider hover:bg-surface-tint hover:shadow-[0_4px_12px_rgba(74,101,78,0.15)] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            Next
            <MaterialIcon name="arrow_forward" size={18} />
          </button>
        </div>

        <footer className="text-center flex items-center justify-center gap-2 text-outline">
          <MaterialIcon name="lock" filled size={14} />
          <span className="text-label-sm uppercase tracking-wider">End-to-End Encrypted</span>
        </footer>
      </main>
    </div>
  );
}
