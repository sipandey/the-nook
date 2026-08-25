# Auto-Lock on Backgrounding — Design

## Problem

The unlock state (the decrypted DEK, held in `useSessionStore`) is
deliberately in-memory only, wiped on any full page reload/kill — but
nothing ever actively re-locks it when the app is merely backgrounded.
On iOS, a backgrounded PWA/tab is typically *suspended*, not killed, so
the in-memory key survives indefinitely across a minimize-then-reopen.
The user noticed this: force-quitting re-prompts for the passphrase,
minimizing doesn't. `content/encryption.md` already states the app
doesn't protect against "someone who has your unlocked device in hand,"
but there's a real gap between that and the journal staying silently
unlocked for hours in the background/app-switcher — worth closing
deliberately rather than leaving as an accident of implementation.

## Decisions

1. **Grace period, not instant lock.** Re-lock after the app has spent
   **60 seconds continuously hidden** — not immediately on backgrounding.
   Switching away briefly (replying to a text mid-entry) doesn't
   interrupt writing; leaving it backgrounded for real does re-lock it.
   Fixed value, not a new Settings toggle — one sensible default rather
   than more surface area to build and maintain.
2. **Applies uniformly to a regular browser tab and an installed PWA.**
   The underlying `visibilitychange` event fires identically in both
   contexts — no special-casing needed or wanted.
3. **A manual "Lock now" affordance in Settings.** The store's `lock()`
   action already exists but is never invoked anywhere in the app today.

## Mechanism

A new hook, `src/lib/hooks/useAutoLock.ts`, listens for
`document.visibilitychange` — the same API `useComposerDraft.ts` already
uses for its own flush-on-background behavior, so a proven mechanism in
this exact app. On `hidden`, start a 60-second `setTimeout`; on `visible`
again before it fires, cancel it (no lock). If it fires, call the
session store's `lock()`.

Mounted once inside `UnlockGate.tsx`, alongside its existing
`isUnlocked`/`unlock` hook calls — `UnlockGate` already wraps every
screen in the `(app)` route group and already owns the lock state, so
when `lock()` fires it naturally stops rendering `children` and shows
the passphrase-unlock screen instead, on whatever page the user returns
to. No new routing logic needed. The hook's effect no-ops entirely while
`isUnlocked` is already `false` — nothing to register, no timer to run.

## Interaction with draft-autosave

`useComposerDraft.ts` already flushes the in-progress draft to IndexedDB
(DEK-encrypted) within ~200ms of the app going hidden — both listeners
fire off the same `visibilitychange` event, and the flush completes 59+
seconds before the lock timer could ever fire. When the user re-unlocks
later, the existing draft-restore flow (NK-01) picks the draft up
normally; nothing here needs to change.

## Manual "Lock now"

A new row in Settings → Privacy & Security (the section added for the
AI off switch), placed after the existing `How we encrypt`/`Privacy
Policy`/`About` links. Calls `lock()` directly on click — no
confirmation dialog: it's non-destructive and instantly reversible by
re-entering the passphrase, consistent with how other reversible
controls in this app already work.

## Testing

This is a DOM/timer-driven hook, not logic with a meaningful pure core
to extract (the whole behavior is "start a timer, cancel it if visible
again") — per this session's established pattern (matching
`useComposerDraft.ts`'s own precedent), it gets live-browser
verification rather than a unit test:

- Lock the app, wait past 60s of simulated hidden state (via
  `document.dispatchEvent`/overriding `visibilityState` in a test
  harness or a real background/foreground cycle), confirm `isUnlocked`
  flips false and the unlock screen renders.
- Background briefly (under 60s), return, confirm still unlocked and no
  interruption to in-progress composer text.
- Confirm "Lock now" in Settings immediately locks and shows the unlock
  screen.
- Confirm no regression to the existing draft-restore flow across a
  genuine backgrounded-past-60s-then-return cycle with unsaved composer
  text.
