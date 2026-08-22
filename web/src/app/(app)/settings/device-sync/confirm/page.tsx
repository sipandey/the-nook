"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSessionStore } from "@/lib/store/session";
import { uploadDek } from "@/lib/deviceSync";

/**
 * Opened by scanning the QR code shown on the new (locked) device — see
 * DeviceSyncPanel.tsx. Being inside src/app/(app)/ means UnlockGate has
 * already required this device to be signed in AND unlocked before this
 * renders, which is exactly the precondition for "an already-unlocked
 * device" that the sync design assumes.
 */
function ConfirmContent() {
  const params = useSearchParams();
  const dek = useSessionStore((s) => s.dek);
  const [status, setStatus] = useState<"working" | "done" | "error">("working");

  useEffect(() => {
    const pairingId = params.get("pairingId");
    const key = typeof window !== "undefined" ? window.location.hash.replace(/^#key=/, "") : "";

    (async () => {
      if (!pairingId || !key || !dek) throw new Error("missing_params");
      await uploadDek(pairingId, decodeURIComponent(key), dek);
    })()
      .then(() => setStatus("done"))
      .catch(() => setStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dek]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      {status === "working" && <p className="text-sm text-muted">Sending your key to the other device…</p>}

      {status === "done" && (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
            <svg viewBox="0 0 20 20" width="24" height="24" fill="none" stroke="#fff" strokeWidth="2">
              <path d="M4 10.5l4 4 8-9" />
            </svg>
          </div>
          <h1 className="text-base font-bold">Device synced</h1>
          <p className="text-xs text-muted">The other device should unlock automatically now.</p>
        </>
      )}

      {status === "error" && (
        <>
          <p className="text-sm text-warn">
            Couldn&rsquo;t complete the sync — the code may have expired.
          </p>
          <p className="text-xs text-muted">Generate a new code on the other device and try again.</p>
        </>
      )}

      <Link href="/settings" className="mt-2 text-sm font-semibold text-accent">
        Back to settings
      </Link>
    </div>
  );
}

export default function DeviceSyncConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmContent />
    </Suspense>
  );
}
