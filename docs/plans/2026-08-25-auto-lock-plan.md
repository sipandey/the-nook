# Auto-Lock on Backgrounding Implementation Plan

**Goal:** Re-lock the journal (wipe the in-memory DEK) after the app has
spent 60 continuous seconds backgrounded, and add a manual "Lock now"
control in Settings.

**Architecture:** A new hook (`useAutoLock`) listens to
`document.visibilitychange`, mirroring the same event
`useComposerDraft.ts` already uses for its own flush-on-background
behavior. Mounted once inside `UnlockGate.tsx`, which already owns
`isUnlocked`/`lock` and already gates every screen in the `(app)` route
group — when the timer fires `lock()`, `UnlockGate` naturally falls back
to its existing unlock screen with no new routing code. A second, much
smaller change adds a manual "Lock now" row to Settings.

**Reference:** `docs/plans/2026-08-25-auto-lock-design.md` (read first for
the "why" — this plan is the "how").

**Tech stack:** Next.js 16, Zustand (`useSessionStore`), standard
`document.visibilitychange`/`setTimeout` — no new dependencies.

---

### Task 1: `useAutoLock` hook

**Files:**
- Create: `web/src/lib/hooks/useAutoLock.ts`

**Step 1: Write the hook**

```ts
// web/src/lib/hooks/useAutoLock.ts
"use client";

import { useEffect } from "react";
import { useSessionStore } from "@/lib/store/session";

/** 1 minute — see docs/plans/2026-08-25-auto-lock-design.md's "Decisions"
 *  section for why a grace period, and why this specific length: long
 *  enough that switching away to reply to a text mid-entry doesn't
 *  interrupt writing, short enough that leaving the app backgrounded for
 *  real still re-locks it, not a new Settings toggle to build/maintain. */
const GRACE_PERIOD_MS = 60_000;

/**
 * Re-locks the journal (via useSessionStore's lock()) after the app has
 * spent GRACE_PERIOD_MS continuously hidden. Mounted once from
 * UnlockGate.tsx, which already owns isUnlocked/lock and already gates
 * every (app) screen — when this fires, UnlockGate naturally falls back
 * to the passphrase-unlock screen with no new routing logic needed here.
 *
 * Uses the same document.visibilitychange event useComposerDraft.ts
 * already relies on for its own flush-on-background behavior — a proven
 * mechanism in this exact app, not a new one. The two listeners don't
 * race: the draft flush completes in well under a second, 59+ seconds
 * before this hook's timer could ever fire.
 *
 * No-ops entirely while already locked — nothing to register, no timer
 * to run, so there's no cost to mounting this unconditionally.
 */
export function useAutoLock() {
  const isUnlocked = useSessionStore((s) => s.isUnlocked);
  const lock = useSessionStore((s) => s.lock);

  useEffect(() => {
    if (!isUnlocked) return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        timeoutId = setTimeout(() => {
          lock();
        }, GRACE_PERIOD_MS);
      } else if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isUnlocked, lock]);
}
```

No unit test for this file — per the design doc's "Testing" section, this
is a DOM/timer-driven hook with no meaningful pure logic to extract
(matching `useComposerDraft.ts`'s own precedent, which also has none).
Verified live in Task 3.

**Step 2: Typecheck**

Run:
```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22.20.0 >/dev/null
cd /Users/sidpande2/Documents/SIDDHARTH/journal/web
npx tsc --noEmit -p . 2>&1 | grep -i "useAutoLock" || echo "no errors in this file"
```
Expected: no errors referencing this file. (A full clean `npm run
typecheck` happens in Task 4 — this is just a fast, targeted check
before wiring it in.)

**Step 3: Commit**

```bash
git config user.name "Siddharth Pandey" && git config user.email "siddharth.pandey06@gmail.com"
cd /Users/sidpande2/Documents/SIDDHARTH/journal
git add web/src/lib/hooks/useAutoLock.ts
git commit -m "Add useAutoLock hook"
git log -1 --format='%an <%ae>'
```

---

### Task 2: Mount it in `UnlockGate`

**Files:**
- Modify: `web/src/components/unlock/UnlockGate.tsx`

**Step 1: Add the import**

Add alongside the existing imports:

```tsx
import { useAutoLock } from "@/lib/hooks/useAutoLock";
```

**Step 2: Call the hook**

Change:

```tsx
export function UnlockGate({ children }: { children: ReactNode }) {
  const { isLoaded: clerkLoaded } = useUser();
  const isUnlocked = useSessionStore((s) => s.isUnlocked);
  const unlock = useSessionStore((s) => s.unlock);
  const { data: keyMaterial, isLoading: keysLoading, error } = useKeyMaterial();
```

to:

```tsx
export function UnlockGate({ children }: { children: ReactNode }) {
  const { isLoaded: clerkLoaded } = useUser();
  const isUnlocked = useSessionStore((s) => s.isUnlocked);
  const unlock = useSessionStore((s) => s.unlock);
  const { data: keyMaterial, isLoading: keysLoading, error } = useKeyMaterial();
  useAutoLock();
```

(Placed with the other hook calls, before any of the function's existing
early returns — required by the rules of hooks, and matches where every
other hook in this component already sits.)

**Step 3: Commit**

```bash
git add web/src/components/unlock/UnlockGate.tsx
git commit -m "Mount useAutoLock in UnlockGate"
```

---

### Task 3: Verify the timer mechanism live

This hook is DOM/timer-driven with no unit test (Task 1), so this step
*is* the real verification, not a formality.

**Step 1: Temporary debug visibility**

Add a temporary line (removed in Step 4, never committed) so the timer
firing is observable from outside React state — the same
add-then-remove-a-debug-script technique this session has used before
for verifying things Preview Mode can't otherwise surface:

In `web/src/lib/hooks/useAutoLock.ts`, temporarily change:
```ts
        timeoutId = setTimeout(() => {
          lock();
        }, GRACE_PERIOD_MS);
```
to:
```ts
        timeoutId = setTimeout(() => {
          console.log("[useAutoLock] grace period elapsed, locking");
          lock();
        }, GRACE_PERIOD_MS);
```

**Step 2: Build and run in preview mode**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22.20.0 >/dev/null
cd /Users/sidpande2/Documents/SIDDHARTH/journal/web
lsof -ti:3100 | xargs -r kill -9 2>/dev/null
rm -rf .next
NEXT_PUBLIC_PREVIEW_MODE=1 OPENAI_API_KEY=sk-ci-placeholder-not-a-real-key npm run build
NEXT_PUBLIC_PREVIEW_MODE=1 PORT=3100 nohup npm start > /tmp/autolock-preview-server.log 2>&1 &
disown
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3100/
```
Expected: `200`.

**Step 3: Simulate backgrounding, faster than a real 60s wait**

Using the Browser pane tools, navigate to `http://localhost:3100/`, then
via `javascript_tool`, force the page hidden and confirm the listener
registers correctly:

```js
Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
document.dispatchEvent(new Event("visibilitychange"));
"dispatched hidden"
```

Then, rather than waiting the real 60 seconds, confirm the *mechanism*
directly — that a `setTimeout` was actually scheduled and that manually
advancing past it fires the callback. Since this sandbox can't fast-forward
real browser timers, do a real (short) wait instead by temporarily
lowering `GRACE_PERIOD_MS` to `3_000` for this one verification pass
only (revert alongside the debug `console.log` in Step 4):

```js
// after setting GRACE_PERIOD_MS = 3_000 for this pass and rebuilding
```

Wait ~4 seconds, then check the console:

Expected: `read_console_messages` shows
`[useAutoLock] grace period elapsed, locking`.

**Step 4: Confirm cancellation on quick return**

Reload the page (fresh unlocked state), dispatch `hidden` again, then
within 1 second dispatch `visible`:
```js
Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
document.dispatchEvent(new Event("visibilitychange"));
```
wait ~500ms, then:
```js
Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
document.dispatchEvent(new Event("visibilitychange"));
```
Wait past the (temporarily shortened) grace period and confirm the
`[useAutoLock]` log does **not** appear — the timer was correctly
cancelled.

**Step 5: Revert the temporary changes**

Restore `useAutoLock.ts` to the Task 1 version exactly — remove the
`console.log` line and confirm `GRACE_PERIOD_MS` is back to `60_000`.
Diff against the Task-1 commit to confirm a clean revert:
```bash
git diff web/src/lib/hooks/useAutoLock.ts
```
Expected: no output (file matches what Task 1 committed).

**Note on a real structural limitation, not a gap to work around:**
`PREVIEW_MODE` deliberately never fakes a Clerk session (see
`.agent-room/decisions.md`'s 2026-08-22 entry) — its `UnlockGate` branch
auto-re-unlocks via `getPreviewDek()` any time `isUnlocked` is false, so
the actual passphrase-unlock *screen* rendering after a real lock can't
be visually demonstrated in this sandbox's preview mode (the same class
of limitation the AI-privacy-controls work hit verifying its own
Clerk-backed toggle). What Steps 3–4 verify instead — that the timer
fires `lock()` at the right time and is correctly cancelled on quick
return — is the actual logic this feature adds; `UnlockGate`'s
`isUnlocked → show unlock screen` branch is pre-existing, unchanged by
this feature, and already exercised by every real sign-in.

---

### Task 4: "Lock now" in Settings

**Files:**
- Modify: `web/src/app/(app)/settings/page.tsx`

**Step 1: Add the import and hook call**

Add near the other imports:

```tsx
import { useSessionStore } from "@/lib/store/session";
```

Inside `SettingsPage()`, alongside the other hook calls:

```tsx
const lock = useSessionStore((s) => s.lock);
```

**Step 2: Add the row**

Inside the existing "Privacy & Security" section (added for the AI-off
switch), after the `About` `SettingRow` and before the section's closing
`</div>`:

```tsx
<SettingRow icon="lock" label="Lock now" onClick={() => lock()} />
```

No confirmation dialog — per the design doc, this is non-destructive and
instantly reversible by re-entering the passphrase, consistent with how
other reversible controls in this app work.

**Step 3: Commit**

```bash
git add web/src/app/\(app\)/settings/page.tsx
git commit -m "Add manual \"Lock now\" control to Settings"
```

---

### Task 5: Full sweep, live no-regression pass, docs, final commit

**Step 1: Full project sweep**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22.20.0 >/dev/null
cd /Users/sidpande2/Documents/SIDDHARTH/journal/web
echo "=== typecheck ===" && npm run typecheck > /tmp/autolock-tc.log 2>&1; echo "exit: $?"
echo "=== lint ===" && npm run lint > /tmp/autolock-lint.log 2>&1; echo "exit: $?"
echo "=== test ===" && npm test > /tmp/autolock-test.log 2>&1; echo "exit: $?"
rm -rf .next
OPENAI_API_KEY=sk-ci-placeholder-not-a-real-key npm run build > /tmp/autolock-build.log 2>&1; echo "exit: $?"
rm -rf .next
```
Expected: all four exit 0. Check each log directly, never through a
piped `tail` — this session's own established anti-pattern.

**Step 2: Live no-regression pass (real 60s grace period, preview mode)**

```bash
cd /Users/sidpande2/Documents/SIDDHARTH/journal/web
lsof -ti:3100 | xargs -r kill -9 2>/dev/null
NEXT_PUBLIC_PREVIEW_MODE=1 OPENAI_API_KEY=sk-ci-placeholder-not-a-real-key npm run build
NEXT_PUBLIC_PREVIEW_MODE=1 PORT=3100 nohup npm start > /tmp/autolock-final-server.log 2>&1 &
disown
```

Using the Browser pane:
1. Navigate to `/write`, type some text into the composer.
2. Dispatch a `hidden` visibilitychange event (as in Task 3), wait ~5
   seconds (well under the real 60s grace period), dispatch `visible`
   again.
3. Confirm the composer's text is unchanged and nothing prompted for a
   passphrase — a brief background does not interrupt an in-progress
   entry.
4. Navigate to `/settings`, confirm the new "Lock now" row renders in
   the Privacy & Security section, styled consistently with the other
   rows.
5. Stop the server: `lsof -ti:3100 | xargs -r kill -9 2>/dev/null`

**Step 3: Update docs**

- `web/README.md` — extend the Settings bullet (already covers the AI
  off switch) to mention auto-lock and the manual "Lock now" control.
- `docs/ARCHITECTURE.md` — a short note near §5/§6.2 (the unlock-flow
  sections) describing the new auto-lock behavior and where it's
  enforced.
- `.agent-room/decisions.md` — append a closing-the-loop entry (`###
  YYYY-MM-DD — title` / `**Decision:**` / `**Why:**` — see this file's
  existing entries for the format the hook checks for) covering: the
  grace-period-over-instant-lock choice and why; why 60 seconds and not
  configurable; that this applies uniformly to browser tab and installed
  PWA on purpose; and the honest note about `PREVIEW_MODE`'s structural
  inability to visually demonstrate the unlock screen after a real lock
  (same class of limitation as the AI-privacy-controls work).

**Step 4: Verify the close-the-loop hook passes**

```bash
cd /Users/sidpande2/Documents/SIDDHARTH/journal
node .agent-room/hooks/close-the-loop-check.js < /dev/null; echo "exit: $?"
```
Expected: exit 0.

**Step 5: Commit**

```bash
git config user.name "Siddharth Pandey" && git config user.email "siddharth.pandey06@gmail.com"
git add web/README.md docs/ARCHITECTURE.md .agent-room/decisions.md
git commit -m "Document auto-lock on backgrounding"
git log -1 --format='%an <%ae>'
```

**Do not push** until the user explicitly says so — matches every prior
turn's pattern in this session.
