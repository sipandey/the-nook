"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MaterialIcon } from "@/components/MaterialIcon";
import { useSessionStore } from "@/lib/store/session";
import { uploadDek } from "@/lib/deviceSync";

/**
 * Opened by scanning the QR code shown on the new (locked) device — see
 * DeviceSyncPanel.tsx. Being inside src/app/(app)/ means UnlockGate has
 * already required this device to be signed in AND unlocked before this
 * renders, which is exactly the precondition for "an already-unlocked
 * device" that the sync design assumes. This uploads the key automatically
 * — no manual "Approve / Deny" step, unlike the Stitch mockup it was built
 * from (see the note in DeviceSyncPanel.tsx).
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
    <div className="font-editorial-sans mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 bg-background px-6 text-center text-on-surface">
      {status === "working" && (
        <>
          <MaterialIcon name="phonelink_setup" size={32} className="text-primary animate-pulse" />
          <p className="text-body-md text-on-surface-variant">Sending your key to the other device…</p>
        </>
      )}

      {status === "done" && (
        <>
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-container shadow-[0_10px_30px_-10px_rgba(74,101,78,0.08)]">
            <MaterialIcon name="check" filled size={36} className="text-on-primary-container" />
          </div>
          <h1 className="font-editorial-display text-headline-lg-mobile text-on-surface">Device Synced</h1>
          <p className="text-body-md text-on-surface-variant">
            The other device should unlock automatically now.
          </p>
        </>
      )}

      {status === "error" && (
        <>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-error-container">
            <MaterialIcon name="sync_problem" size={26} className="text-on-error-container" />
          </div>
          <h1 className="font-editorial-display text-headline-lg-mobile text-on-surface">Couldn&rsquo;t sync</h1>
          <p className="text-body-md text-on-surface-variant max-w-xs">
            The code may have expired. Generate a new one on the other device and try again.
          </p>
        </>
      )}

      <Link href="/settings" className="mt-2 text-label-sm text-primary">
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
