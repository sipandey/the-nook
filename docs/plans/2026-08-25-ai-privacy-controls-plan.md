# AI Privacy Controls Implementation Plan

**Goal:** Give users a real, client-side-enforced way to say "nothing I
write leaves my device," fix the two places the app's privacy copy is
inaccurate, and let a signed-in user actually reach the app's own privacy
explainers instead of hitting a "Sign in" dead end.

**Architecture:** A pure boolean-resolution function
(`src/lib/aiPrivacy.ts`) decides whether AI is enabled, unit-tested under
this repo's existing "node" vitest environment. A thin client hook
(`useAiEnabled.ts`) wraps it around Clerk's `useUser()`/`unsafeMetadata`,
mirroring `useTone.ts` exactly — same storage mechanism, same shape, no
new Supabase column, no migration. Every AI-triggering call site (signal
detection, playback, voice transcription) checks `aiEnabled` and skips its
own fetch entirely when off — the gate lives client-side, before the
network call, not server-side, since a server-side check can't stop
plaintext that's already left the device. Four content files get accuracy
corrections. `PublicPageChrome`'s header becomes signed-in-aware. Two
"End-to-End Encrypted" badges get replaced where they sit under
AI-generated content.

**Tech stack:** Next.js 16, Clerk (`unsafeMetadata`), Vitest 4, existing
Tailwind/MaterialIcon UI primitives already in the codebase.

**Reference:** `docs/plans/2026-08-25-ai-privacy-controls-design.md` (the
approved design — read it first for the "why," this plan is the "how").
That design was corrected once already during planning: the originally
assumed "voice-mode badge" in `write/page.tsx` doesn't exist —
`VoiceRecorder.tsx` shows no encryption badge at all, and both badges
that actually exist in `write/page.tsx` are generic to every save and
accurate as-is. Section 4 below reflects the corrected scope (2 badge
sites total, not 3).

---

### Task 1: Pure AI-enabled resolver, TDD

**Files:**
- Create: `web/src/lib/aiPrivacy.ts`
- Test: `web/src/lib/aiPrivacy.test.ts`

**Step 1: Write the failing test**

```ts
// web/src/lib/aiPrivacy.test.ts
import { describe, expect, it } from "vitest";
import { resolveAiEnabled } from "./aiPrivacy";

describe("resolveAiEnabled", () => {
  it("defaults to true when metadata is undefined", () => {
    expect(resolveAiEnabled(undefined)).toBe(true);
  });

  it("defaults to true when metadata is null", () => {
    expect(resolveAiEnabled(null)).toBe(true);
  });

  it("defaults to true when the field is absent", () => {
    expect(resolveAiEnabled({})).toBe(true);
  });

  it("returns false when explicitly turned off", () => {
    expect(resolveAiEnabled({ aiEnabled: false })).toBe(false);
  });

  it("returns true when explicitly turned on", () => {
    expect(resolveAiEnabled({ aiEnabled: true })).toBe(true);
  });

  it("ignores a non-boolean value and defaults to true", () => {
    expect(resolveAiEnabled({ aiEnabled: "off" })).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22.20.0 >/dev/null
cd /Users/sidpande2/Documents/SIDDHARTH/journal/web
npx vitest run src/lib/aiPrivacy.test.ts
```
Expected: FAIL — `Cannot find module './aiPrivacy'` (the file doesn't exist yet).

**Step 3: Write minimal implementation**

```ts
// web/src/lib/aiPrivacy.ts
/**
 * Pure decision logic for src/lib/hooks/useAiEnabled.ts — kept separate
 * from the Clerk-dependent hook so it's unit-testable under this repo's
 * "node" vitest environment (no jsdom/@testing-library, see
 * vitest.config.mts's own comment on why: hooks that touch React/Clerk
 * get live-browser verification instead, same precedent as useTone.ts
 * and useComposerDraft.ts — neither has a unit test either).
 *
 * Default is `true` (AI on) when the field is absent or the value isn't
 * a boolean — see docs/plans/2026-08-25-ai-privacy-controls-design.md's
 * "Default for existing users" decision: existing users shouldn't wake up
 * to playback/voice silently disabled, this is a new choice being
 * offered, not a removal applied without asking.
 */
export function resolveAiEnabled(
  unsafeMetadata: Record<string, unknown> | null | undefined,
): boolean {
  const value = unsafeMetadata?.aiEnabled;
  return typeof value === "boolean" ? value : true;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/aiPrivacy.test.ts`
Expected: PASS — 6 tests passed.

**Step 5: Commit**

```bash
git config user.name "Siddharth Pandey" && git config user.email "siddharth.pandey06@gmail.com"
cd /Users/sidpande2/Documents/SIDDHARTH/journal
git add web/src/lib/aiPrivacy.ts web/src/lib/aiPrivacy.test.ts
git commit -m "Add resolveAiEnabled, the pure AI-off-switch decision logic"
git log -1 --format='%an <%ae>'
```

---

### Task 2: `useAiEnabled` hook

**Files:**
- Create: `web/src/lib/hooks/useAiEnabled.ts`

**Step 1: Write the hook**

```ts
// web/src/lib/hooks/useAiEnabled.ts
"use client";

import { useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { resolveAiEnabled } from "@/lib/aiPrivacy";

/** Reads/writes the AI-features-on/off switch via Clerk's
 *  user.unsafeMetadata — same mechanism and same reasoning as
 *  src/lib/hooks/useTone.ts (a UI/behavior preference, not sensitive
 *  content, so it doesn't need the encryption model at all). See
 *  docs/plans/2026-08-25-ai-privacy-controls-design.md. */
export function useAiEnabled() {
  const { user, isLoaded } = useUser();
  const aiEnabled = resolveAiEnabled(user?.unsafeMetadata);

  const setAiEnabled = useCallback(
    async (next: boolean) => {
      if (!user) return;
      await user.update({ unsafeMetadata: { ...user.unsafeMetadata, aiEnabled: next } });
    },
    [user],
  );

  return { aiEnabled, setAiEnabled, isLoaded };
}
```

No unit test for this file — it's a thin Clerk wrapper with the same
shape as `useTone.ts`, which also has none; verified live in Task 11.

**Step 2: Typecheck**

Run: `npx tsc --noEmit -p .` (or wait for Task 11's full sweep — this file
alone can't be exercised meaningfully without a component using it, so a
typecheck is the right amount of verification here).
Expected: no new errors.

**Step 3: Commit**

```bash
git add web/src/lib/hooks/useAiEnabled.ts
git commit -m "Add useAiEnabled hook"
```

---

### Task 3: Gate manifestation-signal detection

**Files:**
- Modify: `web/src/lib/hooks/useSignalDetector.ts`

**Step 1: Add the gate**

Change:

```ts
export function useSignalDetector() {
  const queryClient = useQueryClient();

  return async function detect(entryId: string, entryText: string, dek: CryptoKey) {
    try {
```

to:

```ts
export function useSignalDetector() {
  const queryClient = useQueryClient();
  const { aiEnabled } = useAiEnabled();

  return async function detect(entryId: string, entryText: string, dek: CryptoKey) {
    if (!aiEnabled) return;
    try {
```

And add the import at the top, alongside the existing ones:

```ts
import { useAiEnabled } from "@/lib/hooks/useAiEnabled";
```

Also update the file's header doc comment (currently describes this as
"Best-effort background enrichment... swallows its own errors") to add
one sentence: this is also where the AI off switch is enforced — gated
before even the `/api/manifestations` lookup, so turning AI off means
zero network calls from this path, not just zero OpenAI calls.

**Step 2: Commit**

```bash
git add web/src/lib/hooks/useSignalDetector.ts
git commit -m "Gate manifestation-signal detection behind the AI off switch"
```

(No isolated unit test — this hook calls `useQueryClient()`, so exercising
it needs a React render context this repo doesn't have set up (no
jsdom/@testing-library — see Task 1's note). Verified live in Task 11 via
`read_network_requests`, confirming zero calls to `/api/manifestations`
or `/api/ai/detect-signals` when the switch is off.)

---

### Task 4: Gate playback narrative generation

**Files:**
- Modify: `web/src/app/(app)/playback/story/page.tsx`

**Step 1: Add the import and hook call**

Near the other imports:

```tsx
import { useAiEnabled } from "@/lib/hooks/useAiEnabled";
```

Inside `StoryContent()`, alongside the other hook calls near the top
(after `const { tone } = useTone();`):

```tsx
const { aiEnabled } = useAiEnabled();
```

**Step 2: Gate the mutation call**

Change the existing effect:

```tsx
useEffect(() => {
  if (startedRef.current) return;
  if (!allDecrypted || periodEntries.length === 0) return;
  startedRef.current = true;

  narrative.mutate({
    ...
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [allDecrypted, periodEntries.length]);
```

to:

```tsx
useEffect(() => {
  if (startedRef.current) return;
  if (!aiEnabled) return;
  if (!allDecrypted || periodEntries.length === 0) return;
  startedRef.current = true;

  narrative.mutate({
    ...
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [aiEnabled, allDecrypted, periodEntries.length]);
```

(Keep everything inside the `.mutate({...})` call itself unchanged — only
the guard and the deps array change.)

**Step 3: Add an "AI disabled" render state**

Add a new component near `LoadingState` (same file, above
`StoryContent`):

```tsx
function AiDisabledState({ onBack }: { onBack: () => void }) {
  return (
    <div className="font-editorial-sans mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 bg-inverse-surface px-6 text-center text-inverse-on-surface">
      <MaterialIcon name="smart_toy" size={32} className="text-inverse-on-surface/60" />
      <p className="text-body-md text-inverse-on-surface/80 max-w-xs">
        Playback stories are generated by AI from your decrypted entries,
        and you&rsquo;ve turned AI features off.
      </p>
      <Link href="/settings" className="text-sm font-semibold underline underline-offset-2">
        Manage in Settings
      </Link>
      <button type="button" onClick={onBack} className="text-xs text-inverse-on-surface/60 underline">
        Back
      </button>
    </div>
  );
}
```

Add `import Link from "next/link";` if not already present (check first —
it likely isn't, since this file currently uses `useRouter().push` instead
of `<Link>`).

**Step 4: Render it**

Right after the existing early-return:

```tsx
if (!allDecrypted || narrative.isPending || cards.length === 0) {
  return <LoadingState isError={narrative.isError} onBack={() => router.push("/playback")} />;
}
```

add, immediately before it (so the AI-off case is checked first — it
should win over the loading/empty state, not get stuck behind it since
`narrative.data` will never populate when the mutation never fires):

```tsx
if (!aiEnabled) {
  return <AiDisabledState onBack={() => router.push("/playback")} />;
}
```

**Step 5: Commit**

```bash
git add web/src/app/\(app\)/playback/story/page.tsx
git commit -m "Gate playback narrative generation behind the AI off switch"
```

---

### Task 5: Gate voice transcription

**Files:**
- Modify: `web/src/app/(app)/write/page.tsx`

**Step 1: Add the import and hook call**

Add near the other imports:

```tsx
import { useAiEnabled } from "@/lib/hooks/useAiEnabled";
```

Inside `WriteContent()`, alongside `const dek = useSessionStore((s) => s.dek);`:

```tsx
const { aiEnabled } = useAiEnabled();
```

**Step 2: Gate the voice stage render**

Change:

```tsx
if (stage === "voice") {
  return (
    <div className="font-editorial-sans bg-surface text-on-surface h-screen w-full overflow-hidden flex flex-col relative antialiased">
      <VoiceRecorder
        onCancel={() => setStage("text")}
        onTranscribed={(transcript) => {
          setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
          setStage("text");
        }}
      />
    </div>
  );
}
```

to:

```tsx
if (stage === "voice") {
  if (!aiEnabled) {
    return (
      <div className="font-editorial-sans bg-surface text-on-surface h-screen w-full flex flex-col items-center justify-center gap-4 px-6 text-center antialiased">
        <MaterialIcon name="mic_off" size={32} className="text-outline" />
        <p className="text-body-lg text-on-surface-variant max-w-xs">
          Voice notes are transcribed by an AI service, and you&rsquo;ve
          turned AI features off.
        </p>
        <Link href="/settings" className="text-label-sm text-primary underline underline-offset-2">
          Manage in Settings
        </Link>
        <button
          type="button"
          onClick={() => setStage("text")}
          className="text-label-sm text-outline underline underline-offset-2"
        >
          Back to writing
        </button>
      </div>
    );
  }

  return (
    <div className="font-editorial-sans bg-surface text-on-surface h-screen w-full overflow-hidden flex flex-col relative antialiased">
      <VoiceRecorder
        onCancel={() => setStage("text")}
        onTranscribed={(transcript) => {
          setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
          setStage("text");
        }}
      />
    </div>
  );
}
```

This single gate covers both ways `stage` becomes `"voice"` — the
floating mic button during composing, and `?mode=voice` from Home's
"record a voice note" link (line 47's `useState` initializer) — since
both just set/initialize the same `stage` value that this render checks.

`Link` is already imported in this file (used elsewhere for "Back to
Home" etc.) — no new import needed there.

**Step 3: Commit**

```bash
git add web/src/app/\(app\)/write/page.tsx
git commit -m "Gate voice transcription behind the AI off switch"
```

---

### Task 6: Settings — Privacy & Security section

**Files:**
- Modify: `web/src/app/(app)/settings/page.tsx`

**Step 1: Add the import and hook call**

Add near the other imports:

```tsx
import { useAiEnabled } from "@/lib/hooks/useAiEnabled";
```

Inside `SettingsPage()`, alongside the other hook calls:

```tsx
const { aiEnabled, setAiEnabled } = useAiEnabled();
```

**Step 2: Add the section**

Insert a new `<section>` between the closing `</section>` of
"Notifications" and the opening `<section>` for "Account" (i.e., right
before the `<section>` that starts with `<h2 ...>Account</h2>`):

```tsx
<section>
  <h2 className="text-title-md font-editorial-display text-secondary mb-4 px-2">Privacy & Security</h2>
  <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm ring-1 ring-outline/10">
    <div className="setting-row w-full flex items-center justify-between p-4 border-b border-outline/10">
      <div className="flex items-center space-x-4">
        <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary">
          <MaterialIcon name="smart_toy" />
        </div>
        <div className="text-left">
          <div className="text-body-md text-on-surface">Allow AI Features</div>
          <div className="text-sm text-secondary">
            {aiEnabled ? "On — see what this means below" : "Off — nothing you write leaves your device"}
          </div>
        </div>
      </div>
      <Toggle on={aiEnabled} onClick={() => setAiEnabled(!aiEnabled)} />
    </div>
    <SettingRow icon="auto_stories" label="How we encrypt" href="/encryption" />
    <SettingRow icon="shield" label="Privacy Policy" href="/privacy" />
    <SettingRow icon="info" label="About" href="/about" />
  </div>
  <p className="mt-2 text-xs leading-relaxed text-on-surface-variant px-2">
    Turning AI off disables playback stories, voice transcription, and
    manifestation-signal detection — writing, browsing, search, streaks,
    tags, and export all keep working. AI features send your decrypted
    text to OpenAI for a single request each time; see &ldquo;How we
    encrypt&rdquo; above for exactly what that means.
  </p>
</section>
```

(`smart_toy`, `auto_stories`, `shield`, and `info` are Material Symbols
names — `MaterialIcon` takes an arbitrary string, no local allowlist to
update, confirmed by reading `src/components/MaterialIcon.tsx`.)

**Step 3: Commit**

```bash
git add web/src/app/\(app\)/settings/page.tsx
git commit -m "Add Privacy & Security settings section with the AI off switch"
```

---

### Task 7: Manifestation auto-detect label

**Files:**
- Modify: `web/src/components/manifestation/ManifestationForm.tsx`

**Step 1: Update the copy**

Change:

```tsx
<p className="text-body-md text-on-surface-variant pr-4">
  Automatically link journal entries that resonate with this intention.
</p>
```

to:

```tsx
<p className="text-body-md text-on-surface-variant pr-4">
  Sends each new entry&rsquo;s text to OpenAI to check whether it relates
  to this intention. Off by default; only used for entries you write
  after turning it on. Governed by the master AI switch in Settings.
</p>
```

**Step 2: Commit**

```bash
git add web/src/components/manifestation/ManifestationForm.tsx
git commit -m "Make the manifestation auto-detect toggle disclose what it sends"
```

---

### Task 8: Content copy fixes

**Files:**
- Modify: `web/content/privacy.md`
- Modify: `web/content/encryption.md`
- Modify: `web/src/app/about/page.tsx`

**Step 1: `privacy.md`**

Change the OpenAI paragraph from:

```
**OpenAI** — powers the optional AI features (daily prompts, playback story generation, voice transcription, manifestation-signal detection). To do this, your device decrypts the relevant entry text locally and sends it, over an encrypted connection, for that one request only. This is the one point where your written words exist outside your device, even briefly — see the [encryption page](/encryption) for the full detail. We don’t log or store what’s sent. If you never use the AI features, this never happens.
```

to:

```
**OpenAI** — powers the optional AI features: playback story generation, voice transcription, and manifestation-signal detection. (Daily prompts don't send any entry content — they're generic per your chosen tone, not personalized.) To use one of the three that do, your device decrypts the relevant entry text locally and sends it, over an encrypted connection, for that one request only — see the [encryption page](/encryption) for the full detail, including OpenAI's own retention window. We don't log or store what's sent. You can turn all three off entirely from Settings → Privacy & Security; if you do, or if you never use them, this never happens.
```

**Step 2: `encryption.md`**

Change section 6 from:

```
### 6. AI features are the one place plaintext exists off your device — briefly

To generate a daily prompt or a playback story, your device decrypts the relevant entries locally, then sends that plaintext over an encrypted connection to a serverless function for exactly one request to OpenAI. That function is built not to log or persist what it receives, and OpenAI processes it as part of generating the response, not to train on it as a matter of policy for API traffic. This is a real, deliberate exception to “we never see your plaintext” — named here plainly rather than glossed over, because a privacy claim you have to squint to find the caveat in isn’t an honest one.
```

to:

```
### 6. AI features are the one place plaintext exists off your device — briefly, and you can turn it off entirely

To generate a playback story, transcribe a voice note, or detect progress toward a manifestation, your device decrypts the relevant entries locally, then sends that plaintext over an encrypted connection to a serverless function for exactly one request to OpenAI. That function is built not to log or persist what it receives. OpenAI's API traffic isn't used to train their models by default (true since March 2023) — but it is retained by OpenAI itself for up to 30 days for abuse monitoring, unless longer retention is required by law. That's a real, checkable fact, not covered by "we don't retain it" alone, since that sentence is about us, not them.

This is a real, deliberate exception to “we never see your plaintext” — named here plainly rather than glossed over, because a privacy claim you have to squint to find the caveat in isn’t an honest one. If you'd rather nothing you write ever leaves your device, turn AI features off entirely from Settings → Privacy & Security — playback stories, voice transcription, and manifestation-signal detection all stop; writing, browsing, search, streaks, tags, and export are unaffected. Daily prompts don't send entry content in the first place, so they're unaffected either way.
```

**Step 3: `about/page.tsx`**

Change:

```tsx
<span className="text-label-sm">End-to-End Encrypted, by design, not by policy</span>
```

to:

```tsx
<span className="text-label-sm">End-to-End Encrypted, by design — AI features are optional, and yours to turn off</span>
```

**Step 4: Commit**

```bash
git add web/content/privacy.md web/content/encryption.md web/src/app/about/page.tsx
git commit -m "Fix AI privacy copy: correct daily-prompt claim, disclose OpenAI retention, resolve About tagline contradiction"
```

---

### Task 9: Signed-in-aware `PublicPageChrome`

**Files:**
- Modify: `web/src/components/PublicPageChrome.tsx`

**Step 1: Update the header**

Change:

```tsx
"use client";

import Link from "next/link";

/**
 * Header/footer for the small set of public, pre-auth pages (About,
 * Privacy, Encryption explainer, Delete My Data) — see src/proxy.ts's
 * isPublicRoute for the matching auth bypass. Deliberately separate from
 * AppHeader: that component assumes a signed-in visitor (it links to
 * Settings, and its lock icon implies "your journal is encrypted" in the
 * first person) — these pages are reachable by people who haven't signed
 * up yet, so the header offers a way *to* sign in rather than a settings
 * link, and the copy stays in third person ("your entries," not "your
 * journal is currently unlocked").
 */
export function PublicPageHeader() {
  return (
    <header className="w-full sticky top-0 z-40 flex items-center justify-between px-container-padding h-16 shrink-0 bg-background border-b border-outline-variant/20">
      <Link href="/about" className="flex items-center gap-2 text-primary">
        <img src="/brand/logo-mark.png" alt="" width={20} height={20} />
        <span className="font-editorial-display text-title-md">The Nook</span>
      </Link>
      <Link
        href="/sign-in"
        className="text-label-sm text-primary border border-primary/40 rounded-full px-4 py-1.5 hover:bg-primary-container hover:text-on-primary-container transition-colors"
      >
        Sign in
      </Link>
    </header>
  );
}
```

to:

```tsx
"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";

/**
 * Header/footer for the small set of public, pre-auth-reachable pages
 * (About, Privacy, Encryption explainer, Delete My Data) — see
 * src/proxy.ts's isPublicRoute for the matching auth bypass. Deliberately
 * separate from AppHeader: that component assumes a signed-in visitor (it
 * links to Settings, and its lock icon implies "your journal is
 * encrypted" in the first person) — these pages are reachable by people
 * who haven't signed up yet, so the copy stays in third person ("your
 * entries," not "your journal is currently unlocked").
 *
 * The header CTA is the one signed-in-aware piece: a logged-in user who
 * reaches one of these pages (from the new Settings → Privacy & Security
 * links, added in docs/plans/2026-08-25-ai-privacy-controls-design.md, or
 * by typing the URL directly) needs a way back to their journal — it
 * previously hard-coded "Sign in" even for a signed-in visitor, a dead
 * end with no path back to the app.
 */
export function PublicPageHeader() {
  const { isSignedIn } = useUser();

  return (
    <header className="w-full sticky top-0 z-40 flex items-center justify-between px-container-padding h-16 shrink-0 bg-background border-b border-outline-variant/20">
      <Link href="/about" className="flex items-center gap-2 text-primary">
        <img src="/brand/logo-mark.png" alt="" width={20} height={20} />
        <span className="font-editorial-display text-title-md">The Nook</span>
      </Link>
      <Link
        href={isSignedIn ? "/" : "/sign-in"}
        className="text-label-sm text-primary border border-primary/40 rounded-full px-4 py-1.5 hover:bg-primary-container hover:text-on-primary-container transition-colors"
      >
        {isSignedIn ? "Back to journal" : "Sign in"}
      </Link>
    </header>
  );
}
```

(The rest of the file — `PublicPageFooter` — is unchanged.)

**Step 2: Commit**

```bash
git add web/src/components/PublicPageChrome.tsx
git commit -m "Make PublicPageHeader signed-in-aware so it doesn't dead-end a logged-in reader"
```

---

### Task 10: Badge fix on the playback story screens

**Files:**
- Modify: `web/src/app/(app)/playback/story/page.tsx`

**Step 1: First occurrence (loading screen, ~line 96)**

Change:

```tsx
<div className="w-full px-container-padding pb-container-padding flex items-center justify-center gap-2 opacity-60">
  <MaterialIcon name="lock" size={16} />
  <span className="text-label-sm uppercase">End-to-End Encrypted</span>
</div>
```

to:

```tsx
<div className="w-full px-container-padding pb-container-padding flex items-center justify-center gap-2 opacity-60">
  <MaterialIcon name="auto_awesome" size={16} />
  <span className="text-label-sm uppercase">Generated by AI from your decrypted entries</span>
</div>
```

**Step 2: Second occurrence (~line 434)**

Change:

```tsx
<div className="mt-auto pt-8 pb-4 flex justify-center items-center gap-2 opacity-50">
  <MaterialIcon name="lock" size={16} className="text-white" />
  <span className="text-label-sm text-white">End-to-End Encrypted</span>
</div>
```

to:

```tsx
<div className="mt-auto pt-8 pb-4 flex justify-center items-center gap-2 opacity-50">
  <MaterialIcon name="auto_awesome" size={16} className="text-white" />
  <span className="text-label-sm text-white">Generated by AI from your decrypted entries</span>
</div>
```

(Both occurrences use the exact same replacement copy — same screen,
same reason. Every other "End-to-End Encrypted" badge in the app,
including the two in `write/page.tsx`, stays exactly as-is per the design
doc's correction.)

**Step 3: Commit**

```bash
git add web/src/app/\(app\)/playback/story/page.tsx
git commit -m "Replace the encryption badge with an accurate label on AI-generated playback screens"
```

---

### Task 11: Full sweep, live verification, docs, final commit

**Step 1: Full project sweep**

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh" && nvm use 22.20.0 >/dev/null
cd /Users/sidpande2/Documents/SIDDHARTH/journal/web
echo "=== typecheck ===" && npm run typecheck > /tmp/ai-privacy-tc.log 2>&1; echo "exit: $?"
echo "=== lint ===" && npm run lint > /tmp/ai-privacy-lint.log 2>&1; echo "exit: $?"
echo "=== test ===" && npm test > /tmp/ai-privacy-test.log 2>&1; echo "exit: $?"
rm -rf .next
OPENAI_API_KEY=sk-ci-placeholder-not-a-real-key npm run build > /tmp/ai-privacy-build.log 2>&1; echo "exit: $?"
```
Expected: all four exit 0. Check each log directly if not — never trust a
piped `tail`'s exit code (this session's own established anti-pattern).

**Step 2: Live-browser verification (preview mode)**

Start the app in preview mode (same pattern as the append-to-today's-entry
work — Turbopack dev crashes in this sandbox):
```bash
cd /Users/sidpande2/Documents/SIDDHARTH/journal/web
NEXT_PUBLIC_PREVIEW_MODE=1 npm run build > /tmp/ai-privacy-preview-build.log 2>&1; echo "exit: $?"
NEXT_PUBLIC_PREVIEW_MODE=1 PORT=3100 npm start > /tmp/ai-privacy-preview-server.log 2>&1 &
```

Using the Browser pane tools:
1. Open `http://localhost:3100`, sign in via preview auth, navigate to
   `/settings`. Confirm the new "Privacy & Security" section renders with
   the toggle on by default and the three links.
2. Toggle "Allow AI Features" off. Navigate to `/playback`, tap "Play
   Your [period]". Confirm the `AiDisabledState` screen renders (not the
   loading spinner, not a hang) and that `read_network_requests` shows
   **zero** requests to `/api/ai/playback`.
3. With AI still off, go to `/write?mode=voice`. Confirm the gated
   explanation screen renders instead of the recorder, and zero requests
   to `/api/ai/transcribe`.
4. With AI still off, write and save a new entry with an active
   auto-detect manifestation present. Confirm `read_network_requests`
   shows zero requests to `/api/manifestations` or
   `/api/ai/detect-signals` following the save (both should be skipped
   entirely by the Task 3 gate).
5. Toggle AI back on. Repeat playback and voice steps, confirm normal
   behavior resumes and the corresponding `/api/ai/*` requests do appear.
6. As a signed-in user, click each of the three new Settings links
   (`/encryption`, `/privacy`, `/about`) and also navigate to `/privacy`
   directly via the URL bar. Confirm the header shows "Back to journal"
   (not "Sign in") and that clicking it returns to `/`.
7. Screenshot the two playback-story badge locations (loading screen and
   the end-of-story screen) to confirm the new copy renders correctly.

Stop the server afterward:
```bash
pkill -f "next start" 2>/dev/null; true
```

**Step 3: Update docs**

- `docs/ARCHITECTURE.md` — add a short note near §5/§6.4 (the AI-plaintext
  boundary sections) pointing to the new client-side off switch and where
  it's enforced (`useAiEnabled`, gated at each `/api/ai/*` call site
  before the fetch — not server-side).
- `web/README.md` — extend the AI-features bullet in "What's built" to
  mention the Settings → Privacy & Security off switch.
- `.agent-room/decisions.md` — append a closing-the-loop entry (see that
  file's existing entries for the `### YYYY-MM-DD — title` / `**Decision:**`
  / `**Why:**` format the hook checks for) covering: the client-side
  (not server-side) enforcement choice and why a server-side check alone
  would be theater; the single-master-switch decision over three
  per-feature toggles and why; the on-by-default-for-existing-users
  choice; the OpenAI retention fact and that it was verified live against
  `developers.openai.com/api/docs/guides/your-data` in this session, not
  recalled; the daily-prompt overclaim correction found while writing
  this feature; and the design-doc correction made during planning (the
  non-existent "voice-mode badge").

**Step 4: Verify the close-the-loop hook passes**

```bash
cd /Users/sidpande2/Documents/SIDDHARTH/journal
node .agent-room/hooks/close-the-loop-check.js < /dev/null; echo "exit: $?"
```
Expected: exit 0.

**Step 5: Commit**

```bash
git config user.name "Siddharth Pandey" && git config user.email "siddharth.pandey06@gmail.com"
git add docs/ARCHITECTURE.md web/README.md .agent-room/decisions.md
git commit -m "Document AI privacy controls: off switch, retention disclosure, nav fix"
git log -1 --format='%an <%ae>'
```

**Do not push** until the user explicitly says so — matches every prior
turn's pattern in this session.
