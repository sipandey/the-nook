"use client";

import { useQuery } from "@tanstack/react-query";
import type { WrappedKeyMaterial } from "@/lib/crypto";

/** Shape of a journal_keys row as returned by GET /api/keys — snake_case,
 *  matching the Postgres columns directly (see 0001_init.sql / 0002). */
export interface KeyMaterialRow {
  user_id: string;
  created_at: string;
  wrapped_dek: string;
  wrapped_dek_iv: string;
  wrapped_dek_salt: string;
  wrapped_dek_recovery: string;
  wrapped_dek_recovery_iv: string;
  wrapped_dek_recovery_salt: string;
}

export function passphraseMaterial(row: KeyMaterialRow): WrappedKeyMaterial {
  return {
    wrappedKey: row.wrapped_dek,
    iv: row.wrapped_dek_iv,
    salt: row.wrapped_dek_salt,
  };
}

export function recoveryMaterial(row: KeyMaterialRow): WrappedKeyMaterial {
  return {
    wrappedKey: row.wrapped_dek_recovery,
    iv: row.wrapped_dek_recovery_iv,
    salt: row.wrapped_dek_recovery_salt,
  };
}

/**
 * Fetches the signed-in user's wrapped key material. `data === null` (not
 * `undefined` — that's still "loading") means the 404 case: no journal_keys
 * row yet, so the caller needs the first-time passphrase-setup flow rather
 * than the unlock flow.
 */
export function useKeyMaterial() {
  return useQuery({
    queryKey: ["keyMaterial"],
    queryFn: async (): Promise<KeyMaterialRow | null> => {
      const res = await fetch("/api/keys");
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to load key material");
      return res.json();
    },
    retry: false,
  });
}
