# Append to Today's Entry — Implementation Plan

**Goal:** Let a user add another thought to the entry they already wrote
today, instead of always creating a new entry.
**Architecture:** A new `PATCH /api/entries/[id]` (today-only, server-enforced)
re-encrypts the combined plaintext in place; `entries.updated_at` fixes the
playback-cache staleness risk this creates; the `/write` composer grows an
append mode reachable from a context-aware Home CTA and a secondary button
on the entry-detail page.
**Tech stack:** Next.js App Router, Supabase (Postgres + RLS), Clerk, Web
Crypto (client-side AES-GCM), TanStack Query, Vitest.

**Design doc:** `docs/plans/2026-08-24-append-to-todays-entry-design.md` —
read that first for the *why* behind each decision below.

**Testing note (deviation from the generic plan template, deliberately):**
This codebase's own established convention (see NK-02, and every roadmap
item this session) is Vitest unit tests only for pure functions
(`src/lib/crypto/`, and now `getTodaysEntry`/`buildNarrativeCacheKey`
below) — API routes and DB behavior are verified against a real local
Supabase stack (`supabase start`/`db reset`, direct `psql`/`curl`), and UI
against a real browser. Route-handler unit tests would mean mocking Clerk's
`auth()` and the Supabase client, a pattern not used anywhere in this repo;
introducing it for one feature would be inconsistent, not more rigorous.
Each task's "verify" step says which kind of check applies.

**Standing rule for every verification step below:** run `nvm use 22.20.0`
first in any new shell — the sandbox's default `node` (v10.24.1) can't run
this project and produces confusing, unrelated-looking errors if skipped.
Check exit codes directly (`cmd > file.log 2>&1; echo $?`), never through a
piped `tail` — `$?` after a pipe reflects the last command in the pipe, not
the one you care about (this bit a previous turn in this same session).

---

### Task 1: Migration — `entries.updated_at`

**Files:**
- Create: `web/supabase/migrations/0009_entries_updated_at.sql`

(Migration numbering: `0008_grant_service_role.sql` is the latest existing
one — confirm with `ls web/supabase/migrations/` before naming this file,
in case another migration landed since this plan was written.)

**Step 1: Write the migration**

```sql
-- Append-to-today's-entry (docs/ROADMAP.md NK-16 / see the design doc at
-- docs/plans/2026-08-24-append-to-todays-entry-design.md). Entries gain a
-- real update path for the first time — this column is what lets the
-- playback narrative cache (src/lib/playback/narrativeCache.ts) tell a
-- content change apart from a same-ID cache hit; see that file's updated
-- comment once buildNarrativeCacheKey changes in Task 8.
alter table entries
  add column updated_at timestamptz not null default now();

-- Existing rows: updated_at should read the same as created_at, not "now"
-- (every row would otherwise look like it was just edited).
update entries set updated_at = created_at;
```

**Step 2: Apply and verify against a real local Postgres**

```bash
cd web
nvm use 22.20.0
npx --yes supabase@2.115.0 start   # if not already running
npx --yes supabase@2.115.0 db reset
```
Expected: `Applying migration 0009_entries_updated_at.sql...` in the output,
no errors, ending in `Reset local database.`

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -c "\d entries"
```
Expected: `updated_at` listed as `timestamp with time zone`, `not null`,
default `now()`.

**Step 3: Commit**
```bash
git add web/supabase/migrations/0009_entries_updated_at.sql
git commit -m "Add entries.updated_at (append-to-today's-entry)"
```

---

### Task 2: Regenerate Supabase types

**Files:**
- Modify: `web/src/lib/supabase/types.ts`

**Step 1: Regenerate**
```bash
cd web
nvm use 22.20.0
npx --yes supabase@2.115.0 gen types typescript --local > /tmp/nk16-types.ts
```

**Step 2: Diff before trusting it**
```bash
diff <(sed -n '/^export type Json/,$p' src/lib/supabase/types.ts) /tmp/nk16-types.ts
```
Expected: only an `updated_at: string` field added to `entries`'s `Row`,
`Insert` (optional), and `Update` (optional) — nothing else changes. If
anything else differs, stop and find out why before proceeding (another
migration may have landed since Task 1).

**Step 3: Apply the diff**, keeping this file's existing header comment
block (update its "Regenerated" note to mention this migration, same
pattern as the NK-09 entry in that comment already).

**Step 4: Verify with the real compiler, not just eyeballing**
```bash
npm run typecheck > /tmp/nk16-tc.log 2>&1; echo $?
```
Expected: `0`. (Will still fail until Task 3's route change lands, since
`GET /api/entries`'s `.select()` list doesn't request the new column yet —
that's fine, move to Task 3 immediately.)

**Step 5: Stop the local stack, clean up ephemeral state**
```bash
npx --yes supabase@2.115.0 stop
rm -rf supabase/.temp supabase/.branches
```

**Step 6: Commit**
```bash
git add web/src/lib/supabase/types.ts
git commit -m "Regenerate Supabase types for entries.updated_at"
```

---

### Task 3: Return `updated_at` from `GET /api/entries`

**Files:**
- Modify: `web/src/app/api/entries/route.ts` (the `GET` handler's `.select()` call)
- Modify: `web/src/lib/hooks/useEntries.ts` (`EntryMetadata` interface)

**Step 1: Add the column to the select list**

In `GET`'s query, change:
```ts
.select("id, created_at, mood_score, tags, encrypted_content, iv")
```
to:
```ts
.select("id, created_at, updated_at, mood_score, tags, encrypted_content, iv")
```

**Step 2: Add the field to `EntryMetadata`**

In `useEntries.ts`, add `updated_at: string;` to the `EntryMetadata`
interface, next to `created_at`.

**Step 3: Verify**
```bash
npm run typecheck > /tmp/nk16-tc2.log 2>&1; echo $?
```
Expected: `0`.

**Step 4: Commit**
```bash
git add web/src/app/api/entries/route.ts web/src/lib/hooks/useEntries.ts
git commit -m "Return updated_at from GET /api/entries"
```

---

### Task 4: `PATCH /api/entries/[id]` — append endpoint

**Files:**
- Modify: `web/src/app/api/entries/[id]/route.ts` (add a `PATCH` export
  alongside the existing `DELETE`)

**Step 1: Write the handler**

```ts
/**
 * Appends to today's own entry — see docs/plans/2026-08-24-append-to-
 * todays-entry-design.md. The body is already the *combined* re-encrypted
 * plaintext (existing text + the new addition) — this handler never sees
 * plaintext, same as POST /api/entries. Rejects outright if the target
 * entry isn't from today: appending to a past entry is out of scope, not
 * just unavailable in the UI — enforcing it here, not just client-side,
 * matters because a client is never trusted for authorization.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const { encryptedContent, iv, moodScore, tags } = await request.json();

  const supabase = await getSupabaseServerClient();

  const { data: existing, error: fetchError } = await supabase
    .from("entries")
    .select("created_at")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const entryDate = new Date(existing.created_at);
  const now = new Date();
  const isToday =
    entryDate.getFullYear() === now.getFullYear() &&
    entryDate.getMonth() === now.getMonth() &&
    entryDate.getDate() === now.getDate();
  if (!isToday) {
    return NextResponse.json({ error: "not_todays_entry" }, { status: 403 });
  }

  const { error } = await supabase
    .from("entries")
    .update({
      encrypted_content: encryptedContent,
      iv,
      mood_score: moodScore ?? null,
      tags: tags ?? [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

Note: the "today" check uses the *server's* local timezone via bare `Date`
methods — for a solo-builder single-region deployment this matches the
design doc's "device's local calendar day" intent closely enough; a user
right at their own midnight boundary could see a mismatch versus the
server's, same accepted tradeoff already documented for the daily-prompt
cache in `ARCHITECTURE.md` §10.6.1. Not solving that here — flag it in the
design doc's "out of scope" if it becomes a real complaint.

**Step 2: Verify against the real local stack**

```bash
cd web
nvm use 22.20.0
npx --yes supabase@2.115.0 start
npm run dev &   # or next start after a build; either works for this check
```

Insert a fake today-entry directly (bypassing the app, since real Clerk
auth isn't available in this environment either — same constraint noted in
every prior roadmap item's verification this session):
```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "
insert into entries (user_id, encrypted_content, iv, mood_score, tags)
values ('test-user', 'ZmFrZQ==', 'ZmFrZQ==', 3, '{morning}')
returning id;"
```
Note the returned `id`, then directly exercise the SQL the route would run
(since a real PATCH request needs a Clerk session this environment can't
produce) — confirm the update succeeds and `updated_at` changes:
```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "
update entries set encrypted_content = 'dXBkYXRlZA==', updated_at = now()
where id = '<the-id>' and user_id = 'test-user'
returning updated_at;"
```
Expected: a fresh `updated_at`, later than the row's `created_at`.

Then confirm the *rejection* path's logic by hand: insert a row with
`created_at` backdated a day, and confirm the same date-comparison logic
(reason through it against the actual values, or temporarily add a
`console.log` in a scratch script) evaluates `isToday` as `false` for it.
This is the one piece of this task that can't get a full live-request test
without real auth — reasoning through the exact comparison against real
timestamps is the fallback, same constraint as NK-09's live-permission gap.

**Step 3: Full sweep**
```bash
npm run typecheck > /tmp/nk16-tc3.log 2>&1; echo $?
npm run lint > /tmp/nk16-lint.log 2>&1; echo $?
```
Expected: both `0`.

**Step 4: Stop the local stack**
```bash
npx --yes supabase@2.115.0 stop
rm -rf supabase/.temp supabase/.branches
```

**Step 5: Commit**
```bash
git add web/src/app/api/entries/\[id\]/route.ts
git commit -m "Add PATCH /api/entries/[id] for appending to today's entry"
```

---

### Task 5: Signal detection — replace, not accumulate

**Files:**
- Modify: `web/src/app/api/manifestation-signals/route.ts`

**Step 1: Add a delete-before-insert**

In the `POST` handler, before the existing `.insert(...)` call, add:
```ts
const { error: deleteError } = await supabase
  .from("manifestation_signals")
  .delete()
  .eq("entry_id", entryId)
  .eq("user_id", userId);

if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
```
placed after the `if (!entryId || !signals?.length) return ...` early
return, so a call with zero detected signals doesn't wipe an entry's prior
signals for no reason — only actually replace when there's something to
replace them with. Update the file's top comment to note this is now a
replace-on-append operation, not append-only inserts, referencing the
design doc.

**Step 2: Verify against the real local stack**

```bash
cd web
nvm use 22.20.0
npx --yes supabase@2.115.0 start
```
Seed a manifestation, an entry, and a signal row directly, then run the
same delete-then-insert sequence via `psql` that the route now performs,
confirming the row count for that `entry_id` stays at exactly what the
second insert produced — not the sum of both:
```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "
select count(*) from manifestation_signals where entry_id = '<the-id>';"
```
Expected: count matches the *latest* detection result's signal count, not
first-plus-second.

**Step 3: Full sweep + commit**
```bash
npm run typecheck > /tmp/nk16-tc4.log 2>&1; echo $?
npm run lint > /tmp/nk16-lint2.log 2>&1; echo $?
npx --yes supabase@2.115.0 stop && rm -rf supabase/.temp supabase/.branches
git add web/src/app/api/manifestation-signals/route.ts
git commit -m "Replace, not accumulate, manifestation signals on re-detection"
```

---

### Task 6: `buildNarrativeCacheKey` — hash `(id, updated_at)` pairs

**Files:**
- Modify: `web/src/lib/playback/narrativeCache.ts`
- Test: `web/src/lib/playback/narrativeCache.test.ts` (new)

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildNarrativeCacheKey } from "./narrativeCache";

describe("buildNarrativeCacheKey", () => {
  it("produces a different key when an entry's updated_at changes, even with the same entry ids", async () => {
    const before = await buildNarrativeCacheKey("week", "friend", [
      { id: "a", updatedAt: "2026-08-24T10:00:00Z" },
      { id: "b", updatedAt: "2026-08-24T11:00:00Z" },
    ]);
    const after = await buildNarrativeCacheKey("week", "friend", [
      { id: "a", updatedAt: "2026-08-24T10:00:00Z" },
      { id: "b", updatedAt: "2026-08-24T15:30:00Z" }, // b was appended to
    ]);
    expect(before).not.toBe(after);
  });

  it("is stable regardless of input order", async () => {
    const entries = [
      { id: "a", updatedAt: "2026-08-24T10:00:00Z" },
      { id: "b", updatedAt: "2026-08-24T11:00:00Z" },
    ];
    const forward = await buildNarrativeCacheKey("week", "friend", entries);
    const reversed = await buildNarrativeCacheKey("week", "friend", [...entries].reverse());
    expect(forward).toBe(reversed);
  });

  it("differs by period and tone as before", async () => {
    const entries = [{ id: "a", updatedAt: "2026-08-24T10:00:00Z" }];
    const week = await buildNarrativeCacheKey("week", "friend", entries);
    const month = await buildNarrativeCacheKey("month", "friend", entries);
    expect(week).not.toBe(month);
  });
});
```

**Step 2: Run it, confirm it fails for the right reason**
```bash
cd web
nvm use 22.20.0
npm test 2>&1 | tail -20
```
Expected: FAIL — `buildNarrativeCacheKey`'s current signature takes
`entryIds: string[]`, not `{id, updatedAt}[]`; TypeScript/test error about
the argument shape, not a runtime assertion failure.

**Step 3: Change the implementation**

```ts
export interface NarrativeCacheEntryRef {
  id: string;
  updatedAt: string;
}

/**
 * Cache key from (period, tone, sorted (id, updated_at) pairs) — see
 * docs/plans/2026-08-24-append-to-todays-entry-design.md. Entries now have
 * a real update path (appending), so the key can no longer be built from
 * entry IDs alone: a content change with the same ID set must produce a
 * different key, or a narrative cached before an append would silently
 * keep being served after the entry it was based on has grown.
 */
export async function buildNarrativeCacheKey(
  period: string,
  tone: string,
  entries: NarrativeCacheEntryRef[],
): Promise<string> {
  const sorted = [...entries].sort((a, b) => a.id.localeCompare(b.id));
  const canonical = `${period}:${tone}:${sorted.map((e) => `${e.id}@${e.updatedAt}`).join(",")}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

Also update this file's top-of-file comment — it currently says "Entries
have no update path (only DELETE...), so a cache key built from the sorted
set of entry ids is stable with no need for an updated_at/content-hash
component." That's no longer true; replace it with a short note pointing at
this task/the design doc.

**Step 4: Run it, confirm it passes**
```bash
npm test > /tmp/nk16-test.log 2>&1; echo $?
```
Expected: `0`.

**Step 5: Commit**
```bash
git add web/src/lib/playback/narrativeCache.ts web/src/lib/playback/narrativeCache.test.ts
git commit -m "Key the playback narrative cache on (id, updated_at), not bare entry ids"
```

---

### Task 7: Update `usePlaybackNarrative` and its call site

**Files:**
- Modify: `web/src/lib/hooks/usePlaybackNarrative.ts`
- Modify: `web/src/app/(app)/playback/story/page.tsx:145-150`

**Step 1: Change `PlaybackRequest`**

In `usePlaybackNarrative.ts`, replace the `entryIds: string[]` field on
`PlaybackRequest` with `entries: NarrativeCacheEntryRef[]` (import that
type from `@/lib/playback/narrativeCache`), and update both
`buildNarrativeCacheKey(input.period, input.tone, input.entryIds)` calls in
this file to `buildNarrativeCacheKey(input.period, input.tone, input.entries)`.

**Step 2: Update the call site**

In `playback/story/page.tsx`, change:
```ts
entryIds: periodEntries.map((e) => e.id),
```
to:
```ts
entries: periodEntries.map((e) => ({ id: e.id, updatedAt: e.updated_at })),
```

**Step 3: Verify**
```bash
cd web
nvm use 22.20.0
npm run typecheck > /tmp/nk16-tc5.log 2>&1; echo $?
```
Expected: `0`.

**Step 4: Commit**
```bash
git add web/src/lib/hooks/usePlaybackNarrative.ts "web/src/app/(app)/playback/story/page.tsx"
git commit -m "Pass (id, updated_at) pairs through to the narrative cache key"
```

---

### Task 8: `getTodaysEntry` helper

**Files:**
- Create: `web/src/lib/todaysEntry.ts`
- Test: `web/src/lib/todaysEntry.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";
import { getTodaysEntry } from "./todaysEntry";
import type { EntryMetadata } from "@/lib/hooks/useEntries";

function entry(overrides: Partial<EntryMetadata>): EntryMetadata {
  return {
    id: "id",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    mood_score: null,
    tags: [],
    encrypted_content: "",
    iv: "",
    ...overrides,
  };
}

describe("getTodaysEntry", () => {
  it("returns undefined when there are no entries", () => {
    expect(getTodaysEntry([])).toBeUndefined();
  });

  it("returns undefined when no entry is from today", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(getTodaysEntry([entry({ created_at: yesterday.toISOString() })])).toBeUndefined();
  });

  it("returns the entry created today", () => {
    const today = entry({ id: "today-entry" });
    const yesterday = entry({
      id: "yesterday-entry",
      created_at: new Date(Date.now() - 86_400_000).toISOString(),
    });
    expect(getTodaysEntry([yesterday, today])?.id).toBe("today-entry");
  });

  it("returns the most recently created of several same-day entries", () => {
    const earlier = entry({ id: "earlier", created_at: new Date(Date.now() - 3600_000).toISOString() });
    const later = entry({ id: "later", created_at: new Date().toISOString() });
    expect(getTodaysEntry([earlier, later])?.id).toBe("later");
  });
});
```

**Step 2: Run it, confirm it fails**
```bash
cd web
nvm use 22.20.0
npm test 2>&1 | tail -20
```
Expected: FAIL — module `./todaysEntry` doesn't exist yet.

**Step 3: Write the implementation**

```ts
import type { EntryMetadata } from "@/lib/hooks/useEntries";

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * The entry to append to when opening the composer without an explicit
 * ?entryId= — see docs/plans/2026-08-24-append-to-todays-entry-design.md.
 * "Today" is the device's local calendar day, matching the existing
 * "one year ago today" comparison in journal/[id]/page.tsx. If more than
 * one entry happens to exist for today (e.g. from before this feature
 * shipped), the most recently *created* one wins — arbitrary but
 * deterministic, and not a case new entries can produce going forward.
 */
export function getTodaysEntry(entries: EntryMetadata[]): EntryMetadata | undefined {
  const now = new Date();
  const todays = entries.filter((e) => isSameLocalDay(new Date(e.created_at), now));
  if (todays.length === 0) return undefined;
  return todays.reduce((latest, e) =>
    new Date(e.created_at) > new Date(latest.created_at) ? e : latest,
  );
}
```

**Step 4: Run it, confirm it passes**
```bash
npm test > /tmp/nk16-test2.log 2>&1; echo $?
```
Expected: `0`.

**Step 5: Commit**
```bash
git add web/src/lib/todaysEntry.ts web/src/lib/todaysEntry.test.ts
git commit -m "Add getTodaysEntry helper"
```

---

### Task 9: `useAppendToEntry` hook

**Files:**
- Create: `web/src/lib/hooks/useAppendToEntry.ts`

**Step 1: Write it** (mirrors `useSaveEntry.ts`'s shape exactly)

```ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { encryptText } from "@/lib/crypto";

export interface AppendToEntryInput {
  entryId: string;
  plaintext: string;
  moodScore: number | null;
  tags: string[];
  dek: CryptoKey;
}

/** Re-encrypts the *combined* plaintext (caller already concatenated the
 *  existing text + the new addition) and PATCHes it in place — see
 *  docs/plans/2026-08-24-append-to-todays-entry-design.md. Same
 *  encrypt-then-send posture as useSaveEntry: plaintext never leaves this
 *  function. */
export function useAppendToEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entryId, plaintext, moodScore, tags, dek }: AppendToEntryInput) => {
      const { ciphertext, iv } = await encryptText(plaintext, dek);

      const res = await fetch(`/api/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encryptedContent: ciphertext,
          iv,
          moodScore,
          tags,
        }),
      });

      if (!res.ok) throw new Error("Failed to append to entry");
      return { id: entryId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
    },
  });
}
```

**Step 2: Verify**
```bash
cd web
nvm use 22.20.0
npm run typecheck > /tmp/nk16-tc6.log 2>&1; echo $?
```
Expected: `0`.

**Step 3: Commit**
```bash
git add web/src/lib/hooks/useAppendToEntry.ts
git commit -m "Add useAppendToEntry hook"
```

---

### Task 10: Append-mode composer

**Files:**
- Modify: `web/src/app/(app)/write/page.tsx`

This is the largest single task — do it as one deliberate pass, not
piecemeal, since the append-mode branch touches state initialization,
effects, and the render tree together. Re-read the current file in full
immediately before starting (it may have changed since this plan was
written).

**Step 1: Add append-mode detection**

Add imports: `useDecryptedEntries` (from `@/lib/hooks/useDecryptedEntries`),
`getTodaysEntry` (from `@/lib/todaysEntry`), `useAppendToEntry`.

After the existing `const { data: entries } = useEntries();` line, add:
```ts
const appendEntryId = params.get("entryId");
const todaysEntry = useMemo(() => getTodaysEntry(entries ?? []), [entries]);
const appendTarget = useMemo(() => {
  if (appendEntryId) return entries?.find((e) => e.id === appendEntryId);
  return todaysEntry;
}, [appendEntryId, entries, todaysEntry]);
const isAppendMode = Boolean(appendTarget);

const appendDecrypted = useDecryptedEntries(appendTarget ? [appendTarget] : undefined, dek);
const existingText = appendTarget ? appendDecrypted[appendTarget.id] : undefined;
```

Note `dek` must be defined before this point — it already is
(`const dek = useSessionStore((s) => s.dek);` near the top).

**Step 2: Pre-fill mood/tags in append mode**

Change the `mood`/`tags` initial `useState` calls to account for append
mode. Since `appendTarget` isn't known synchronously on the very first
render in all cases (it depends on `entries` having loaded), use an effect
rather than a lazy initializer:
```ts
useEffect(() => {
  if (!appendTarget) return;
  setMood(appendTarget.mood_score);
  setTags(appendTarget.tags);
}, [appendTarget]);
```
Place this after the existing draft-restore effect. Ordering matters: a
restored draft (from `useComposerDraft`) should win over the entry's stored
mood/tags if the user had an in-progress append draft — but since this
effect only fires once `appendTarget` resolves (typically before any
drafted mood/tags would differ), and both effects use plain `setState`
calls rather than functional updates, whichever runs *last* wins on a given
render. In practice `entries` is usually already cached by the time this
page mounts (TanStack Query), so this effect and the draft-restore effect
both fire close together; if this proves flaky in manual testing (Step 5),
guard this effect with `if (!appendTarget || showRestoredBanner) return;`
instead, so a restored draft takes precedence.

**Step 3: Change `handleSave` to branch on append mode**

```ts
const appendToEntry = useAppendToEntry();

async function handleSave() {
  if (!dek || !text.trim()) return;

  if (isAppendMode && appendTarget && existingText !== undefined) {
    const combined = `${existingText}\n\n${text.trim()}`;
    const mergedTags = [...new Set([...appendTarget.tags, ...tags])];
    await appendToEntry.mutateAsync({
      entryId: appendTarget.id,
      plaintext: combined,
      moodScore: mood,
      tags: mergedTags,
      dek,
    });
    clearDraft();
    setSavedId(appendTarget.id);
    setStage("saved");
    void detectSignals(appendTarget.id, combined, dek);
    return;
  }

  const plaintext = title.trim() ? `${title.trim()}\n\n${text.trim()}` : text.trim();
  const result = await saveEntry.mutateAsync({ plaintext, moodScore: mood, tags, dek });
  clearDraft();
  setSavedId(result.id);
  setStage("saved");
  void detectSignals(result.id, plaintext, dek);
}
```

Note this reuses `tags` as "the union already computed," so the earlier
`mergedTags` line does the actual merge — `useAppendToEntry` itself stays
dumb (just PATCHes whatever tags array it's given), matching how
`useSaveEntry` doesn't know about merge semantics either.

Update the button's `disabled` condition
(`disabled={!text.trim() || saveEntry.isPending || !dek}`) to also check
`appendToEntry.isPending` when in append mode:
```ts
disabled={!text.trim() || saveEntry.isPending || appendToEntry.isPending || !dek}
```
and the button label similarly (`saveEntry.isPending || appendToEntry.isPending ? "Saving…" : ...`).

**Step 4: Render the existing text + hide the title field in append mode**

In the main (non-voice, non-saved) render branch, immediately before the
`<input ... placeholder="Title (optional)" />`, add:
```tsx
{isAppendMode && (
  <div className="mb-4 rounded-lg bg-surface-container-low px-4 py-3 text-body-md text-on-surface-variant/70 whitespace-pre-wrap max-h-48 overflow-y-auto">
    {existingText ?? "Loading today's entry…"}
  </div>
)}
```
Wrap the title `<input>` in `{!isAppendMode && (...)}` — no title field in
append mode (see design doc: a title belongs to the entry as a whole, set
once).

Change the textarea's placeholder to be mode-aware:
```tsx
placeholder={isAppendMode ? "Add another thought…" : "Start writing…"}
```

**Step 5: Manual verification (live browser)**

No automated test covers this task — verify live, following this session's
established pattern (build with `NEXT_PUBLIC_PREVIEW_MODE=1`, or use a real
signed-in session if available):
1. With an existing today-entry, open `/write` — confirm the existing text
   renders read-only above an empty new-addition field, mood/tags are
   pre-filled.
2. Add text, save — confirm the entry list (`/journal`) still shows *one*
   entry for today, not two, and its content is the concatenation with a
   blank line between.
3. Open the entry detail page for that entry — confirm the combined text
   renders correctly.
4. Add a *second* append the same day — confirm it appends again (not
   overwrites), and mood/tags reflect the merge behavior.

**Step 6: Full sweep**
```bash
cd web
nvm use 22.20.0
npm run typecheck > /tmp/nk16-tc7.log 2>&1; echo $?
npm run lint > /tmp/nk16-lint3.log 2>&1; echo $?
npm test > /tmp/nk16-test3.log 2>&1; echo $?
```
Expected: all `0`.

**Step 7: Commit**
```bash
git add "web/src/app/(app)/write/page.tsx"
git commit -m "Add append mode to the entry composer"
```

---

### Task 11: Home CTA label

**Files:**
- Modify: `web/src/app/(app)/page.tsx`

**Step 1: Change the label**

Add the import: `getTodaysEntry` from `@/lib/todaysEntry`.

Near where `streak` is computed (`useMemo(() => computeStreak(...), [entries])`),
add:
```ts
const todaysEntry = useMemo(() => getTodaysEntry(entries ?? []), [entries]);
```

Change the "New entry" link's text (around line 141):
```tsx
{todaysEntry ? "Continue today's entry" : "New entry"}
```
The `href` itself does **not** change — it stays plain `/write` either way;
the composer's own on-mount `getTodaysEntry` check (Task 10) is what
actually branches behavior, so this page doesn't need to pass an
`entryId` through the URL for this path. (The `?mood=` variant on the same
link, when a mood is picked, is unaffected — append mode in the composer
already handles pre-filled mood from the *entry*, but a query-string
`?mood=` on top of that is for the case where there's no today-entry yet;
Task 10's effect already resolves precedence correctly since it only fires
when `appendTarget` exists.)

**Step 2: Verify**
```bash
cd web
nvm use 22.20.0
npm run typecheck > /tmp/nk16-tc8.log 2>&1; echo $?
```
Expected: `0`.

**Step 3: Live browser check**: with a today-entry present, confirm Home's
button reads "Continue today's entry"; with none, confirm it still reads
"New entry".

**Step 4: Commit**
```bash
git add "web/src/app/(app)/page.tsx"
git commit -m "Home CTA reflects whether today's entry already exists"
```

---

### Task 12: "Add to this entry" on the entry-detail page

**Files:**
- Modify: `web/src/app/(app)/journal/[id]/page.tsx`

**Step 1: Add the button**

Add the import: `getTodaysEntry` from `@/lib/todaysEntry`.

After the `entry` lookup (`const entry = useMemo(() => entries?.find(...), ...)`),
add:
```ts
const isTodaysEntry = useMemo(
  () => Boolean(entry && getTodaysEntry(entries ?? [])?.id === entry.id),
  [entry, entries],
);
```

In the render, inside `<article>` after the mood/tags block (after the
`{(entry.mood_score || entry.tags.length > 0) && (...)}` section, before
the closing `</article>`), add:
```tsx
{isTodaysEntry && (
  <div className="mt-stack-gap pt-stack-gap border-t border-surface-variant">
    <Link
      href={`/write?entryId=${entry.id}`}
      className="inline-flex items-center gap-2 text-label-sm text-primary hover:text-primary-fixed-dim transition-colors"
    >
      <MaterialIcon name="add" size={16} />
      Add to this entry
    </Link>
  </div>
)}
```

**Step 2: Verify**
```bash
cd web
nvm use 22.20.0
npm run typecheck > /tmp/nk16-tc9.log 2>&1; echo $?
```
Expected: `0`.

**Step 3: Live browser check**: viewing today's own entry shows the button
and it navigates into append mode correctly (`?entryId=` path, Task 10
Step 1's `appendEntryId` branch); viewing a past entry does not show it.

**Step 4: Commit**
```bash
git add "web/src/app/(app)/journal/[id]/page.tsx"
git commit -m "Add \"Add to this entry\" button for today's own entry"
```

---

### Task 13: Full-project sweep + docs

**Files:**
- Modify: `docs/ROADMAP.md` (resolve NK-16)
- Modify: `docs/ARCHITECTURE.md` (§10.6.2, and §2's core-features table if
  it's worth a one-line mention — read both sections fresh before editing,
  they may have shifted since this plan was written)
- Modify: `.agent-room/decisions.md` (append an entry — see
  `.agent-room/skills/closing-the-loop.md` for the required format)
- Modify: `web/README.md` ("What's built" — entry composer bullet already
  mentions draft persistence; extend it, don't duplicate a new bullet)

**Step 1: Full sweep, one more time, on the finished feature**
```bash
cd web
nvm use 22.20.0
npm run typecheck > /tmp/nk16-final-tc.log 2>&1; echo $?
npm run lint > /tmp/nk16-final-lint.log 2>&1; echo $?
npm test > /tmp/nk16-final-test.log 2>&1; echo $?
rm -rf .next
OPENAI_API_KEY=sk-ci-placeholder-not-a-real-key npm run build > /tmp/nk16-final-build.log 2>&1; echo $?
rm -rf .next
```
Expected: all four `0`.

**Step 2: Update the docs**, referencing this plan's design doc, and record
the closing-the-loop decision entry — cover: why "append," not full
editing (matches the user's actual stated need, smaller surface); the
signal-detection replace decision and why it matters (duplicate rows would
break "the signal count means something"); the cache-key fix and why it
was necessary now, not optional.

**Step 3: Verify the close-the-loop hook is satisfied**
```bash
cd /Users/sidpande2/Documents/SIDDHARTH/journal
node .agent-room/hooks/close-the-loop-check.js < /dev/null 2>&1; echo $?
```
Expected: `0`.

**Step 4: Commit**
```bash
git add docs/ROADMAP.md docs/ARCHITECTURE.md .agent-room/decisions.md web/README.md
git commit -m "Document append-to-today's-entry (resolves NK-16)"
```

**Step 5: Do not push** until the user explicitly says so — matches every
prior turn's pattern in this session.

---

## Notes for whoever executes this (fresh session or not)

- Tasks 1–9 are independently verifiable without a browser; do them in
  order, each with its own commit, before touching any UI file.
- Tasks 10–12 depend on all of 1–9 being in place (the hooks/types they
  wire into).
- If context runs out mid-plan: the design doc plus this plan together are
  self-contained — a fresh session can resume from whichever task's commit
  hasn't landed yet, same as any other task in this codebase's history.
