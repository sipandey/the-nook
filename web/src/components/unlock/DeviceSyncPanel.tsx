"use client";

import { useEffect, useRef, useState } from "react";
import { QrCode } from "@/components/QrCode";
import { useSessionStore } from "@/lib/store/session";
import { createPairingSession, pollForDek, type PairingSession } from "@/lib/deviceSync";

const POLL_INTERVAL_MS = 2500;

/**
 * Shown on a new (locked) device. Generates a pairing session + QR code,
 * then polls until an already-unlocked device (opened the QR/link,
 * confirmed via src/app/(app)/settings/device-sync/confirm/) uploads the
 * DEK. See src/lib/deviceSync.ts for the crypto — nothing here ever sees
 * or sends the passphrase; this is a parallel path to it, not a replacement.
 */
export function DeviceSyncPanel({ onBack }: { onBack: () => void }) {
  const [session, setSession] = useState<PairingSession | null>(null);
  const [status, setStatus] = useState<"starting" | "waiting" | "expired" | "error">("starting");
  const unlock = useSessionStore((s) => s.unlock);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    createPairingSession()
      .then((s) => {
        if (cancelled) return;
        setSession(s);
        setStatus("waiting");
      })
      .catch(() => !cancelled && setStatus("error"));

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (!session || status !== "waiting") return;

    pollRef.current = setInterval(async () => {
      try {
        const result = await pollForDek(session.pairingId, session.channelKeyBase64);
        if (result.status === "ready") {
          if (pollRef.current) clearInterval(pollRef.current);
          unlock(result.dek);
        } else if (result.status === "expired") {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatus("expired");
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current);
        setStatus("error");
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [session, status, unlock]);

  if (status === "starting") {
    return <p className="text-xs text-muted">Setting up…</p>;
  }

  if (status === "error" || status === "expired") {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-xs text-warn">
          {status === "expired" ? "That code expired." : "Couldn't start device sync."}
        </p>
        <button type="button" onClick={onBack} className="text-xs font-semibold text-accent">
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {session && <QrCode value={session.url} size={180} />}
      <p className="text-xs leading-relaxed text-muted">
        Scan this with an already-unlocked device — its camera app will open
        the link directly — or copy it below and open it there.
      </p>
      {session && (
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(session.url)}
          className="w-full truncate rounded-[8px] border-[1.2px] border-border bg-surface px-2.5 py-2 text-[10px] text-muted"
        >
          {session.url}
        </button>
      )}
      <div className="flex items-center gap-1.5 text-[10px] text-faint">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        Waiting for the other device…
      </div>
      <button type="button" onClick={onBack} className="text-[11px] font-semibold text-accent">
        Use my passphrase instead
      </button>
    </div>
  );
}
