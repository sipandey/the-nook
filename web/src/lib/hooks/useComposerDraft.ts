"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { PREVIEW_MODE } from "@/lib/preview";
import { decryptText, encryptText } from "@/lib/crypto";
import { useSessionStore } from "@/lib/store/session";
import { clearStoredDraft, getStoredDraft, putStoredDraft } from "@/lib/composer/draftStore";

export interface ComposerDraft {
  title: string;
  text: string;
  mood: number | null;
  tags: string[];
}

const AUTOSAVE_DEBOUNCE_MS = 800;

function isBlank(draft: ComposerDraft): boolean {
  return !draft.title.trim() && !draft.text.trim() && draft.mood === null && draft.tags.length === 0;
}

/**
 * Persists the entry composer's in-progress draft to IndexedDB, encrypted
 * with the DEK — see docs/ROADMAP.md NK-01 and src/lib/composer/draftStore.ts.
 *
 * Restoring is a one-shot effect: it fires once dek/userId are available,
 * and a ref (not state) tracks whether it already ran so a re-render never
 * clobbers text the user has since typed. Autosaving is debounced and
 * intentionally skipped until that restore attempt finishes, so the
 * composer's blank initial state doesn't overwrite a real stored draft in
 * the brief window before it loads.
 *
 * The debounce alone doesn't cover the failure mode this exists for — a
 * mobile OS can kill a backgrounded tab well inside 800ms of the last
 * keystroke. flushDraft() writes immediately (bypassing the debounce) for
 * callers to wire to `visibilitychange`; even that is best-effort, since
 * neither `visibilitychange` nor `pagehide` can guarantee async work (a
 * Web Crypto encrypt + an IndexedDB write) finishes before teardown — it
 * meaningfully narrows the loss window without claiming to close it.
 *
 * A restored draft is delivered via `onRestore`, called once from inside
 * the restore effect's own async work — not exposed as separate state for
 * the caller to mirror into its own effect. That would be exactly the
 * "adjust state when a value changes" shape `react-hooks/set-state-in-effect`
 * flags; routing it through a callback invoked from the async restore
 * itself (the same shape src/lib/hooks/useDecryptedMap.ts already uses)
 * avoids it structurally instead of suppressing the lint rule.
 */
export function useComposerDraft(onRestore: (draft: ComposerDraft) => void) {
  const { user } = useUser();
  const dek = useSessionStore((s) => s.dek);
  const userId = PREVIEW_MODE ? "preview-user" : user?.id;

  const [isRestoring, setIsRestoring] = useState(true);
  const hasAttemptedRestore = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onRestoreRef = useRef(onRestore);
  useEffect(() => {
    onRestoreRef.current = onRestore;
  });

  useEffect(() => {
    if (hasAttemptedRestore.current || !dek || !userId) return;
    hasAttemptedRestore.current = true;

    (async () => {
      try {
        const stored = await getStoredDraft(userId);
        if (stored) {
          const json = await decryptText({ ciphertext: stored.ciphertext, iv: stored.iv }, dek);
          const parsed = JSON.parse(json) as ComposerDraft;
          if (!isBlank(parsed)) onRestoreRef.current(parsed);
        }
      } catch {
        // A corrupt/undecryptable draft shouldn't block the composer from
        // opening — treat it the same as no draft at all.
      } finally {
        setIsRestoring(false);
      }
    })();
  }, [dek, userId]);

  const writeNow = useCallback(
    async (draft: ComposerDraft) => {
      if (!dek || !userId) return;
      try {
        if (isBlank(draft)) {
          await clearStoredDraft(userId);
          return;
        }
        const { ciphertext, iv } = await encryptText(JSON.stringify(draft), dek);
        await putStoredDraft(userId, { ciphertext, iv });
      } catch {
        // Autosave is a safety net, not the primary save path — a storage
        // error here shouldn't surface to the user mid-typing.
      }
    },
    [dek, userId],
  );

  const saveDraft = useCallback(
    (draft: ComposerDraft) => {
      if (!dek || !userId || isRestoring) return;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => void writeNow(draft), AUTOSAVE_DEBOUNCE_MS);
    },
    [dek, userId, isRestoring, writeNow],
  );

  const flushDraft = useCallback(
    (draft: ComposerDraft) => {
      if (!dek || !userId || isRestoring) return;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      void writeNow(draft);
    },
    [dek, userId, isRestoring, writeNow],
  );

  const clearDraft = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!userId) return;
    void clearStoredDraft(userId);
  }, [userId]);

  return { isRestoring, saveDraft, flushDraft, clearDraft };
}
