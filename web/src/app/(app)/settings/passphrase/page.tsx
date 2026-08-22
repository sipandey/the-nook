"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
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
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
          <svg viewBox="0 0 20 20" width="24" height="24" fill="none" stroke="#fff" strokeWidth="2">
            <path d="M4 10.5l4 4 8-9" />
          </svg>
        </div>
        <h1 className="text-base font-bold">Passphrase updated</h1>
        <p className="text-xs text-muted">
          Your recovery code still works — it wraps the same key independently.
        </p>
        <button type="button" onClick={() => router.push("/settings")} className="mt-2 text-sm font-semibold text-accent">
          Back to settings
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <div className="flex flex-shrink-0 items-center gap-3 px-3.5 pt-3.5 pb-2.5">
        <button type="button" onClick={() => router.back()} aria-label="Back" className="flex h-7 w-7 items-center justify-center">
          <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M12.5 4.5L6.5 10l6 5.5" />
          </svg>
        </button>
        <span className="text-[13px] font-bold">Change journal passphrase</span>
      </div>

      <div className="flex flex-1 flex-col gap-3.5 px-4 pt-2 pb-4">
        <p className="text-xs leading-relaxed text-muted">
          This is separate from your account password. You don&rsquo;t need
          your old passphrase — being signed in and unlocked here already
          proves it.
        </p>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">
            New passphrase
          </label>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            autoFocus
            className="w-full rounded-[9px] border-[1.3px] border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted">
            Confirm new passphrase
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-[9px] border-[1.3px] border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>
        {error && <p className="text-xs text-warn">{error}</p>}
        {change.isError && <p className="text-xs text-warn">Couldn&rsquo;t update your passphrase. Try again.</p>}

        <div className="flex-1" />
        <button
          type="button"
          onClick={() => change.mutate()}
          disabled={!canSubmit || change.isPending || !dek}
          className="rounded-[10px] bg-accent px-4 py-3 text-[13px] font-semibold text-white disabled:opacity-40"
        >
          {change.isPending ? "Saving…" : "Update passphrase"}
        </button>
      </div>
    </div>
  );
}
