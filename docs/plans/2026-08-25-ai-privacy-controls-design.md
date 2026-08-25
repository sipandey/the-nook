# AI Privacy Controls — Design

## Problem

Users have raised a real concern: "the app uses AI, so how secure is my
journal really?" The fear — that AI involvement means a third party has
access to their deepest, most private writing — is only partly answered
by the app today.

**What's already true and already honest:** entries are genuinely
unreadable to the operator at rest (`docs/ARCHITECTURE.md` §5).
`content/encryption.md` §6 already discloses the AI exception plainly
instead of burying it. Semantic search deliberately runs a local
embedding model (`Xenova/all-MiniLM-L12-v2`, `src/lib/search/embed.worker.ts`)
rather than calling OpenAI — there's real precedent for the
on-device-first posture. `/api/ai/prompt` sends nothing personal at all
(`generateDailyPrompt(tone, [])` — empty summaries list, cached and
shared across all users on the same tone).

**What's actually missing, found by reading the real code rather than the
docs:**

1. **No off switch.** A user who wants "nothing I write ever leaves my
   device" has no way to say that. Settings has an AI Tone picker and
   nothing else.
2. **One AI path is automatic and its consent is mismatched.**
   `useSignalDetector.ts` fires after every entry save, gated only on a
   manifestation's `auto_detect` flag — a flag the user set on a *goal*,
   with no indication it means "every entry's text goes to OpenAI."
3. **The privacy copy underclaims one specific, checkable fact.**
   `content/privacy.md` says AI content "is not retained *by us*" — true,
   and silent on OpenAI's own retention. Verified against OpenAI's current
   API data-usage docs (`developers.openai.com/api/docs/guides/your-data`,
   fetched live, not recalled): API traffic is not used for training by
   default (true since March 2023, and already stated correctly), but is
   retained **up to 30 days for abuse monitoring, unless longer retention
   is required by law**. That number appears nowhere in the app.
4. **`privacy.md` also overclaims one feature.** It lists "daily prompts"
   among the things that send entry text to OpenAI. They don't — see
   point above. Fixing this actually *shrinks* the disclosed surface from
   four AI features to three.
5. **The About tagline is self-contradicting.** "End-to-End Encrypted, by
   design, not by policy" — but the AI exception is protected precisely
   *by policy* (OpenAI's retention/training terms), not by anything the
   app's own design guarantees.
6. **No in-app path to the app's own best answer.** `content/about.md`,
   `encryption.md`, `privacy.md`, and `delete-my-data.md` are pre-auth-only
   pages (`PublicPageChrome.tsx`'s own doc comment says so explicitly).
   Worse than merely unlinked: `PublicPageHeader` hard-codes a **"Sign
   in"** button, so even a signed-in user who types `/privacy` manually
   lands on a page that assumes they're a stranger, with no path back to
   their journal.

**Explicitly out of scope for this round** (raised, considered, and
deliberately deferred — see the "Open questions" section below for why):
content redaction/filtering before AI calls (strip identifiers, a
user-maintained word list, opt-in numbers/dates, placeholder restoration,
a what-will-be-sent preview) and pursuing Zero Data Retention with OpenAI
(closes the 30-day-retention gap entirely, but requires OpenAI sales
approval — an account-level step outside this codebase).

## Scope for this round

1. A real AI off switch, enforced client-side.
2. Honest copy: disclose OpenAI's actual retention, fix the daily-prompt
   overclaim, resolve the About tagline contradiction.
3. In-app navigation to the content pages for signed-in users, plus a
   fixed `PublicPageChrome` that doesn't dead-end a logged-in reader.
4. A surgical badge fix on the two screens where "End-to-End Encrypted"
   sits directly under AI-generated-from-plaintext content.

## Section 1 — The AI control

**One master switch, not three.** A new "Privacy & Security" section in
Settings, above Account, holding a single toggle: **Allow AI features**.
Body copy beneath it names the trade-off explicitly: turning it off
disables playback stories, voice transcription, and manifestation-signal
detection; writing, browsing, search, streaks, tags, and export are
unaffected.

Rejected: three independent per-feature toggles. The value of this
control is the sentence a user can say afterward — "nothing I write
leaves my device." Partial toggles mean no clean sentence is available,
and that sentence *is* the feature.

**Storage: Clerk `unsafeMetadata`, mirroring `useTone.ts` exactly.**

```ts
// src/lib/hooks/useAiEnabled.ts
"use client";
import { useCallback } from "react";
import { useUser } from "@clerk/nextjs";

export function useAiEnabled() {
  const { user, isLoaded } = useUser();
  const aiEnabled = (user?.unsafeMetadata?.aiEnabled as boolean | undefined) ?? true;

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

Default `true` when unset — see "Default for existing users" below. Same
mechanism as `tone`, so no migration, no new Supabase column, and
`useUser()` already has the value client-side with no extra round trip.

**Enforced client-side, before the network call — this is the
load-bearing detail.** A server-side check alone would be theater: by the
time a request reaches `/api/ai/*`, the plaintext has already left the
device over the wire. The gate has to sit in front of the `fetch`, not
behind it.

- `src/lib/hooks/useSignalDetector.ts` — read `aiEnabled` (via a
  `useAiEnabled()` call at the top of the hook body, not inside the
  returned `detect` closure, so it's fresh each render like `dek` already
  is) and return early, before the `/api/manifestations` fetch, if false.
- Playback ("Play Your Week" — wherever it triggers `/api/ai/playback`):
  same early gate before the fetch; if `aiEnabled` is false, render a
  short explanation with a link to the new Settings section instead of a
  dead button.
- Voice mode composer (`/write?mode=voice`, before
  `/api/ai/transcribe`): same pattern — explain, link to Settings,
  don't silently fail.
- `/api/ai/prompt` is **not gated** — it sends nothing personal (empty
  summaries list), so gating it would remove a harmless feature for no
  privacy benefit.

**`auto_detect` on manifestations stays, now subordinate to the master
switch, and gets honest labelling.** The manifestation form's copy near
that toggle should say plainly that turning it on means each new entry's
text is sent to OpenAI for detection — not just "auto-detect signals."

**Default for existing users: on, disclosed — not silently flipped off.**
Nobody's playback or voice notes should vanish overnight; this ships as a
new choice being offered, surfaced prominently in the updated Settings
section and privacy copy, not a removal applied without asking.

## Section 2 — Copy fixes

All four are accuracy corrections, not new claims:

1. **`content/privacy.md`** — remove "daily prompts" from the list of
   AI features that send entry text (it doesn't: empty summaries list,
   shared cache). Add OpenAI's actual retention: not used for training by
   default; retained up to 30 days for abuse monitoring, unless longer
   retention is legally required. Update "optional" to actually be true
   (true today only once the switch exists) and mention the new setting.
2. **`content/encryption.md` §6** — same retention fact added to the
   existing "AI features are the one place plaintext exists off your
   device" section, plus a pointer to the new Settings toggle as the way
   to opt out entirely.
3. **`content/about.md`** tagline — "End-to-End Encrypted, by design, not
   by policy" becomes something that doesn't contradict itself once an
   opt-out exists, e.g. "End-to-End Encrypted, by design — AI features
   are optional, and yours to turn off." Exact copy finalized during
   implementation, matching the page's existing voice.
4. **`ManifestationForm.tsx`** — the `auto_detect` toggle's label/help
   text, per Section 1 above.

## Section 3 — In-app access + nav fix

**New Settings section** ("Privacy & Security"), positioned above
Account, containing:
- The **Allow AI features** toggle (Section 1).
- Three `SettingRow` links, matching the existing pattern used for
  Account/Export: *How we encrypt* → `/encryption`, *Privacy Policy* →
  `/privacy`, *About* → `/about`. `Delete my data` is intentionally not
  duplicated here — it stays reachable only via the existing Delete
  Account flow, where it's contextually correct.

**`PublicPageChrome.tsx` becomes signed-in-aware.** `PublicPageHeader`
currently hard-codes a "Sign in" button. Change: read auth state
(`useUser()` or equivalent) and render "Back to journal" → `/` when
signed in, "Sign in" → `/sign-in` when not. One component change fixes
the dead-end for all four content pages (`about`, `encryption`,
`privacy`, `delete-my-data`) at once. Copy on these pages stays
third-person per the existing doc comment's reasoning — only the header
CTA is state-aware, not the body text.

## Section 4 — Badge fix (surgical)

Only two call sites change, where "End-to-End Encrypted" sits directly
beneath content that only exists because plaintext left the device:

- `src/app/(app)/playback/story/page.tsx` (two occurrences, lines ~96
  and ~434) — replace with copy that's specific to what actually
  happened, e.g. "Your entries are encrypted · this story was generated
  by AI from your decrypted text," or similar, finalized during
  implementation to match the page's existing tone.
- The voice recorder screen in `src/app/(app)/write/page.tsx` (the
  voice-mode badge instance, not the text-mode one).

The other ~22 occurrences are accurate as-is (entries genuinely are E2EE
at rest on those screens) and are explicitly left untouched.

## Testing / verification plan

- Unit: `useAiEnabled` default (unset → `true`), toggle round-trips
  through `user.update`.
- Unit: `useSignalDetector` returns early (no fetch calls) when
  `aiEnabled` is false — mock `useAiEnabled`, assert `fetch` not called.
- Manual, live-browser (preview mode, same pattern as the
  append-to-today's-entry work): toggle off, confirm playback/voice/write
  all show the disabled-state explanation and make zero requests to
  `/api/ai/playback`, `/api/ai/transcribe`, `/api/ai/detect-signals`
  (checked via `read_network_requests`, not just UI appearance). Toggle
  on, confirm normal behavior resumes.
- Manual: as a signed-in user, navigate to `/privacy`, `/encryption`,
  `/about` both via the new Settings links and by typing the URL
  directly; confirm the header shows "Back to journal," not "Sign in,"
  and that it correctly returns to `/`.
- Read-through: confirm no remaining code path claims daily prompts send
  entry content, and that the retention sentence in `privacy.md` and
  `encryption.md` matches the wording verified against OpenAI's docs in
  this design.

## Open questions / deliberately deferred

- **Content redaction/filtering** (strip identifiers, user word list,
  opt-in numbers/dates redaction, client-side placeholder restoration, a
  what-will-be-sent preview) — a real, worthwhile follow-up, but a
  meaningfully larger design on its own (new client-side transform layer,
  UI for managing a personal word list, and care around not degrading
  playback's verbatim-quote feature or signal detection's accuracy).
  Deferred to a separate design once this round ships.
- **Zero Data Retention with OpenAI** — would close the 30-day-retention
  gap entirely rather than just disclosing it, and covers all three
  plaintext-sending endpoints (`chat/completions`, `audio/transcriptions`).
  Requires OpenAI sales approval and acceptance of additional terms — an
  account-level step outside this codebase, not something implementable
  in a PR. Worth pursuing in parallel with this design, not blocking it.
