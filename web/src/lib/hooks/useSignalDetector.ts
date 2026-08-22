"use client";

import { useQueryClient } from "@tanstack/react-query";
import { decryptText } from "@/lib/crypto";
import type { ManifestationRow } from "@/lib/hooks/useManifestations";

/**
 * Best-effort background enrichment, run after an entry save succeeds
 * (see src/app/(app)/write/page.tsx). Deliberately fire-and-forget from
 * the caller's side and swallows its own errors — this is the feature
 * flagged as a gap in src/app/api/entries/route.ts's POST handler,
 * finally wired up. A failure here (network blip, AI call error) must
 * never surface as if the entry itself failed to save; the user already
 * saw their entry saved successfully by the time this runs.
 */
export function useSignalDetector() {
  const queryClient = useQueryClient();

  return async function detect(entryId: string, entryText: string, dek: CryptoKey) {
    try {
      const res = await fetch("/api/manifestations");
      if (!res.ok) return;
      const manifestations: ManifestationRow[] = await res.json();

      const candidates = manifestations.filter((m) => m.status === "active" && m.auto_detect);
      if (candidates.length === 0) return;

      const decryptedManifestations = await Promise.all(
        candidates.map(async (m) => ({
          id: m.id,
          text: await decryptText({ ciphertext: m.encrypted_text, iv: m.iv }, dek),
        })),
      );

      const detectRes = await fetch("/api/ai/detect-signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryText, manifestations: decryptedManifestations }),
      });
      if (!detectRes.ok) return;

      const { signals } = await detectRes.json();
      if (!signals?.length) return;

      await fetch("/api/manifestation-signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, signals }),
      });

      queryClient.invalidateQueries({ queryKey: ["manifestations"] });
    } catch {
      // Best-effort — see the doc comment above.
    }
  };
}
