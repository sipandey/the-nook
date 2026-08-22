"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { MaterialIcon } from "@/components/MaterialIcon";
import { wrapDataEncryptionKey } from "@/lib/crypto";
import { useSessionStore } from "@/lib/store/session";

const MIN_LENGTH = 10;

export default function ChangePassphrasePage() {
  const router = useRouter();
  const dek = useSessionStore((s) => s.dek);
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);

  const change = useMutation({
    mutationFn: async () => {
      if (!dek) throw new Error("locked");
      const wrap = await wrapDataEncryptionKey(dek, passphrase);
      const res = await fetch("/api/keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wrappedDek: wrap.wrappedKey,
          wrappedDekIv: wrap.iv,
          wrappedDekSalt: wrap.salt,
        }),
      });
      if (!res.ok) throw new Error("Failed to update passphrase");
    },
    onSuccess: () => setDone(true),
  });

  const error =
    passphrase.length > 0 && passphrase.length < MIN_LENGTH
      ? `At least ${MIN_LENGTH} characters`
      : confirm.length > 0 && confirm !== passphrase
        ? "Doesn't match"
        : null;
  const canSubmit = passphrase.length >= MIN_LENGTH && passphrase === confirm;

  if (done) {
    return (
      <div className="font-editorial-sans mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-container">
          <MaterialIcon name="check" filled className="text-on-primary-container" size={24} />
        </div>
        <h1 className="font-editorial-display text-headline-md text-on-surface">Passphrase updated</h1>
        <p className="text-body-md text-on-surface-variant">
          Your recovery phrase still works — it wraps the same key independently.
        </p>
        <button type="button" onClick={() => router.push("/settings")} className="mt-2 text-label-sm text-primary">
          Back to settings
        </button>
      </div>
    );
  }

  return (
    <div className="font-editorial-sans bg-background text-on-background min-h-screen flex flex-col antialiased">
      <header className="w-full top-0 sticky bg-background flex justify-between items-center px-container-padding h-16 z-40">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="text-primary hover:opacity-80 transition-opacity p-2 -ml-2"
        >
          <MaterialIcon name="arrow_back" />
        </button>
        <h1 className="font-editorial-display text-headline-md text-primary text-center flex-1">The Nook</h1>
        <span className="w-6" />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-container-padding py-stack-gap w-full max-w-lg mx-auto">
        <div className="w-full space-y-stack-gap">
          <div className="text-center space-y-4">
            <h1 className="font-editorial-display text-headline-md text-on-surface">Change Passphrase</h1>
            <p className="text-body-md text-on-surface-variant max-w-sm mx-auto">
              You don&rsquo;t need your old passphrase — being signed in and unlocked here already
              proves it. This new phrase becomes your only key.
            </p>
          </div>

          <div className="bg-surface-container-low rounded-xl p-6 text-center space-y-3 shadow-sm border border-surface-variant">
            <MaterialIcon name="error" filled className="text-secondary" size={32} />
            <p className="text-sm text-secondary">
              <strong>Critical Warning:</strong> If you lose this new passphrase, your past entries
              cannot be recovered. We cannot reset it for you.
            </p>
          </div>

          <div className="space-y-6 w-full">
            <div className="space-y-1">
              <label htmlFor="new-passphrase" className="text-label-sm text-on-surface-variant uppercase tracking-wider block">
                New Passphrase
              </label>
              <input
                id="new-passphrase"
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                autoFocus
                placeholder="Enter a secure phrase"
                className="w-full border-0 border-b border-outline-variant focus:border-primary focus:ring-0 bg-transparent py-3 text-body-lg text-on-surface transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="confirm-passphrase" className="text-label-sm text-on-surface-variant uppercase tracking-wider block">
                Confirm Passphrase
              </label>
              <input
                id="confirm-passphrase"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter to confirm"
                className="w-full border-0 border-b border-outline-variant focus:border-primary focus:ring-0 bg-transparent py-3 text-body-lg text-on-surface transition-colors"
              />
            </div>

            {error && <p className="text-sm text-error">{error}</p>}
            {change.isError && <p className="text-sm text-error">Couldn&rsquo;t update your passphrase. Try again.</p>}

            <div className="pt-4">
              <button
                type="button"
                onClick={() => change.mutate()}
                disabled={!canSubmit || change.isPending || !dek}
                className="w-full bg-primary text-on-primary text-label-sm py-4 rounded-full hover:opacity-90 active:scale-95 transition-all shadow-[0_4px_14px_0_rgba(74,101,78,0.15)] flex justify-center items-center gap-2 disabled:opacity-40"
              >
                <span>{change.isPending ? "Saving…" : "Update Passphrase"}</span>
                <MaterialIcon name="lock_reset" size={18} />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 pt-stack-gap text-on-surface-variant opacity-70">
            <MaterialIcon name="lock" size={16} />
            <span className="text-label-sm">End-to-End Encrypted</span>
          </div>
        </div>
      </main>
    </div>
  );
}
