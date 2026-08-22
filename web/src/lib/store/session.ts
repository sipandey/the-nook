/**
 * Holds the unwrapped Data-Encryption Key (DEK) for the current session.
 *
 * Deliberately NOT persisted (no localStorage/IndexedDB, no Zustand persist
 * middleware) — the DEK must be re-derived from the journal passphrase on
 * every fresh app load. Losing it on refresh is the correct, intended
 * behavior, not a bug: it's what "the server never sees plaintext, and
 * neither does disk" actually requires client-side.
 */

import { create } from "zustand";

interface SessionState {
  dek: CryptoKey | null;
  isUnlocked: boolean;
  unlock: (dek: CryptoKey) => void;
  lock: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  dek: null,
  isUnlocked: false,
  unlock: (dek) => set({ dek, isUnlocked: true }),
  lock: () => set({ dek: null, isUnlocked: false }),
}));
