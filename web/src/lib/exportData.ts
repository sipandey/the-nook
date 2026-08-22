"use client";

import { decryptText } from "@/lib/crypto";
import type { EntryMetadata } from "@/lib/hooks/useEntries";
import type { ManifestationRow } from "@/lib/hooks/useManifestations";

/**
 * Decrypts everything client-side and triggers a browser download — this
 * data never touches a server in plaintext, matching the rest of the
 * encryption model. There's no export API route because there's nothing
 * for the server to do here; it only ever serves ciphertext.
 */
export async function exportUserData(dek: CryptoKey): Promise<void> {
  const [entriesRes, manifestationsRes] = await Promise.all([
    fetch("/api/entries"),
    fetch("/api/manifestations"),
  ]);
  if (!entriesRes.ok || !manifestationsRes.ok) {
    throw new Error("Couldn't load your data for export");
  }

  const entries: EntryMetadata[] = await entriesRes.json();
  const manifestations: ManifestationRow[] = await manifestationsRes.json();

  const decryptedEntries = await Promise.all(
    entries.map(async (e) => ({
      date: e.created_at,
      mood: e.mood_score,
      tags: e.tags,
      text: await decryptText({ ciphertext: e.encrypted_content, iv: e.iv }, dek).catch(
        () => "(couldn't decrypt)",
      ),
    })),
  );

  const decryptedManifestations = await Promise.all(
    manifestations.map(async (m) => ({
      createdAt: m.created_at,
      category: m.category,
      cadence: m.cadence,
      status: m.status,
      text: await decryptText({ ciphertext: m.encrypted_text, iv: m.iv }, dek).catch(
        () => "(couldn't decrypt)",
      ),
    })),
  );

  const payload = {
    exportedAt: new Date().toISOString(),
    entries: decryptedEntries,
    manifestations: decryptedManifestations,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `the-nook-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
