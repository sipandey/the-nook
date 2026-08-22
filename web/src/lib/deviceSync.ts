"use client";

/**
 * Multi-device key handoff. The server (device-sync API routes) only ever
 * stores the DEK encrypted under a one-time "channel key" — that key is
 * generated here, on the new device, and never sent over the network: it
 * travels only as part of a QR code (an optical channel) and in the URL
 * fragment, which browsers never include in HTTP requests. See
 * docs/ARCHITECTURE.md and the route comments for the full model.
 */

import {
  generateDataEncryptionKey,
  exportKeyToBase64,
  importKeyFromBase64,
  encryptText,
  decryptText,
} from "@/lib/crypto";

export interface PairingSession {
  pairingId: string;
  channelKeyBase64: string;
  url: string;
  expiresAt: string;
}

/** Called on the new (locked) device. */
export async function createPairingSession(): Promise<PairingSession> {
  const pairingId = crypto.randomUUID();
  const channelKey = await generateDataEncryptionKey();
  const channelKeyBase64 = await exportKeyToBase64(channelKey);

  const res = await fetch("/api/device-sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairingId }),
  });
  if (!res.ok) throw new Error("Couldn't start device sync");
  const { expiresAt } = await res.json();

  const url = `${window.location.origin}/settings/device-sync/confirm?pairingId=${pairingId}#key=${encodeURIComponent(channelKeyBase64)}`;

  return { pairingId, channelKeyBase64, url, expiresAt };
}

export type PollResult = { status: "pending" } | { status: "expired" } | { status: "ready"; dek: CryptoKey };

/** One poll attempt from the new device — callers loop this on an interval. */
export async function pollForDek(pairingId: string, channelKeyBase64: string): Promise<PollResult> {
  const res = await fetch(`/api/device-sync/${pairingId}`);
  if (res.status === 404) return { status: "expired" };
  if (!res.ok) throw new Error("Sync check failed");

  const data = await res.json();
  if (data.pending) return { status: "pending" };

  const channelKey = await importKeyFromBase64(channelKeyBase64);
  const dekBase64 = await decryptText(
    { ciphertext: data.encryptedDek, iv: data.encryptedDekIv },
    channelKey,
  );
  const dek = await importKeyFromBase64(dekBase64);
  return { status: "ready", dek };
}

/** Called on the already-unlocked device that scanned/opened the QR link. */
export async function uploadDek(
  pairingId: string,
  channelKeyBase64: string,
  dek: CryptoKey,
): Promise<void> {
  const channelKey = await importKeyFromBase64(channelKeyBase64);
  const dekBase64 = await exportKeyToBase64(dek);
  const { ciphertext, iv } = await encryptText(dekBase64, channelKey);

  const res = await fetch(`/api/device-sync/${pairingId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ encryptedDek: ciphertext, encryptedDekIv: iv }),
  });
  if (!res.ok) throw new Error("Couldn't complete sync");
}
