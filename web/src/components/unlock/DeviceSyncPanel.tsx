"use client";

import { useEffect, useRef, useState } from "react";
import { QrCode } from "@/components/QrCode";
import { MaterialIcon } from "@/components/MaterialIcon";
import { useSessionStore } from "@/lib/store/session";
import { createPairingSession, pollForDek, type PairingSession } from "@/lib/deviceSync";

const POLL_INTERVAL_MS = 2500;

/**
 * Shown on a new (locked) device. Generates a pairing session + QR code,
 * then polls until an already-unlocked device (opened the QR/link,
 * confirmed via src/app/(app)/settings/device-sync/confirm/) uploads the
 * DEK. See src/lib/deviceSync.ts for the crypto — nothing here ever sees
 * or sends the passphrase; this is a parallel path to it, not a replacement.
 *
 * Unlike the Stitch mockup this was built from, there's no manual
 * "Approve / Deny" step on the other device — the real pairing flow
 * uploads the key automatically once that device opens the scanned link
 * (see settings/device-sync/confirm/page.tsx), so this stays honest about
 * what's actually happening instead of implying a confirmation gate that
 * doesn't exist.
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
    return (
      <div className="flex flex-col items-center text-center gap-2">
        <MaterialIcon name="sync" size={28} className="text-primary animate-spin" />
        <p className="text-body-md text-on-surface-variant">Setting up…</p>
      </div>
    );
  }

  if (status === "error" || status === "expired") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-error-container flex items-center justify-center">
          <MaterialIcon name="sync_problem" size={28} className="text-on-error-container" />
        </div>
        <h2 className="font-editorial-display text-headline-lg-mobile text-on-surface">
          {status === "expired" ? "That code expired" : "Couldn't start device sync"}
        </h2>
        <p className="text-body-md text-on-surface-variant max-w-xs">
          Generate a new code and try again.
        </p>
        <button type="button" onClick={onBack} className="text-label-sm text-outline hover:text-primary transition-colors py-2">
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-full bg-primary-container flex items-center justify-center mb-inline-gap shadow-[0_10px_30px_-10px_rgba(74,101,78,0.08)] animate-pulse">
        <MaterialIcon name="sync" size={28} className="text-on-primary-container" />
      </div>
      <h2 className="font-editorial-display text-headline-lg-mobile text-on-surface mb-2">Device Sync</h2>
      <p className="text-body-md text-on-surface-variant mb-stack-gap max-w-xs">
        Scan this code with a device that&rsquo;s already unlocked — its camera app will open the
        link directly.
      </p>

      {session && (
        <div className="bg-surface-container-low p-6 rounded-2xl mb-stack-gap shadow-[0_10px_30px_-10px_rgba(74,101,78,0.08)] border border-surface-variant">
          <QrCode value={session.url} size={180} />
        </div>
      )}

      {session && (
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(session.url)}
          className="w-full truncate rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 py-2 text-xs text-on-surface-variant mb-inline-gap"
        >
          {session.url}
        </button>
      )}

      <div className="flex items-center gap-2 text-outline mb-inline-gap">
        <MaterialIcon name="progress_activity" size={16} className="animate-spin" />
        <span className="text-label-sm">Waiting for secure sync…</span>
      </div>

      <button type="button" onClick={onBack} className="text-label-sm text-outline hover:text-primary transition-colors py-2">
        Cancel Sync
      </button>
    </div>
  );
}
