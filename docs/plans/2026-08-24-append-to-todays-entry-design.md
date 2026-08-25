# Append to today's entry — design

Status: approved, not yet built.

## Problem

The composer only ever creates a new entry. A user who has several distinct
thoughts across one day — a morning note, an afternoon aside, an evening
reflection — ends up with several separate journal entries for that day
instead of the one they actually wanted: multiple thoughts, one post.

This was previously flagged as the open decision in `docs/ROADMAP.md` NK-16
("entry editing — or deliberate immutability") and `docs/ARCHITECTURE.md`
§10.6.2 (the playback narrative cache assumes entries never change content).
This design resolves it as a narrower feature than general editing: appending
to *today's* entry only, not editing arbitrary past entries.

## Decisions (made with the user, in order)

1. **Entry point**: Home's "new entry" CTA becomes context-aware — it reads
   "Continue today's entry" and lands in append mode automatically when one
   exists, rather than asking each time or requiring a separate discovery
   step. A secondary explicit path exists too (see below).
2. **Signal detection**: re-runs against the full updated entry on every
   append, replacing (not accumulating) that entry's prior
   `manifestation_signals` rows.
3. **Mood/tags on append**: mood can be updated (replaces the prior value —
   there's one `mood_score` per entry); tags are additive (union of old and
   new, nothing dropped).
4. **Separator**: a blank line between the existing text and each addition.
   No timestamp header, no visual divider — reads as one continuous entry.
5. **"Today" boundary**: the device's local calendar day, matching the
   existing "one year ago today" memory feature's own date comparison — not
   UTC.
6. **Secondary entry point**: the entry-detail page also gets a small "Add
   to this entry" button, shown only when viewing today's own entry — for
   reaching append mode by navigating to the entry directly rather than
   through Home.

## Data model & backend

- **`entries` gains an update path.** Today only `INSERT`/`DELETE` exist
  (`src/app/api/entries/route.ts`, `src/app/api/entries/[id]/route.ts`). New
  `PATCH /api/entries/[id]`: re-encrypted `encrypted_content`/`iv`, updated
  `mood_score`/`tags`, scoped to the caller's own row (RLS + explicit
  `user_id` check, matching the existing `DELETE` handler's pattern).
  Rejects the request server-side if the target entry's `created_at` isn't
  today — appending to an old entry is out of scope for this feature, not
  just unsupported in the UI.
- **New `entries.updated_at` column**, `timestamptz not null default now()`,
  defaulting to match `created_at` for existing rows, bumped by the `PATCH`
  handler on every append. This is the fix for the playback-cache staleness
  risk in §10.6.2: `buildNarrativeCacheKey` (`src/lib/playback/narrativeCache.ts`)
  currently hashes only the sorted entry-ID set for a period, so an entry
  whose *content* changes after a narrative was cached would silently keep
  serving the stale version forever (the ID set is unchanged, so the old key
  still matches). The key changes to hash `(id, updated_at)` pairs instead
  of bare IDs — an append naturally produces a new key, so the stale cache
  entry is simply never looked up again (not deleted — orphaned bytes in
  IndexedDB, acceptable, same posture as other client-side caches in this
  codebase).
- **Signal detection replace, not accumulate.** `POST
  /api/manifestation-signals` (`src/app/api/manifestation-signals/route.ts`)
  currently does a plain `insert` with no dedupe and no unique constraint on
  `(manifestation_id, entry_id)` in the schema. Before inserting fresh
  signals for an entry, the route now deletes existing
  `manifestation_signals` rows for that `entry_id` first — re-running
  detection on a grown entry can't produce duplicate rows against the same
  manifestation, and the signal count stays meaningful (per
  `ARCHITECTURE.md`'s existing "conservative, so the signal count means
  something" invariant).
- **Migration**: one new file, `entries.updated_at` + nothing else schema-side
  (the signal-replace behavior is a route-logic change, not a schema change).

## Client-side flow

- **`useEntries`** needs to select and return `updated_at` alongside the
  existing columns (`GET /api/entries`'s select list, and the
  `EntryMetadata` type it returns).
- **A small `getTodaysEntry(entries)` helper** (local-day comparison, same
  approach as the existing "one year ago today" logic in
  `journal/[id]/page.tsx`) — used by both Home (to decide the CTA label) and
  the composer (to decide append vs. new on plain `/write`).
- **`/write` accepts an optional `?entryId=` query param.** If present,
  that's authoritative — append mode for that specific entry (the
  entry-detail page's button uses this, sidestepping any date-boundary
  ambiguity). If absent, the composer derives `getTodaysEntry` itself on
  mount: if one exists, append mode for it; if not, the composer behaves
  exactly as it does today.
- **Append-mode composer**: today's existing text (decrypted client-side)
  renders read-only/muted above a fresh, empty field for the new addition —
  voice or text, same `VoiceRecorder`/textarea as the normal composer, no
  special-casing needed there. Mood picker pre-filled with the entry's
  current mood, changeable. Tag input pre-filled with current tags, additive.
  No title field in this mode — a title belongs to the entry as a whole, set
  once on first save, not editable via append.
- **Save**: `existingPlaintext + "\n\n" + newPlaintext`, re-encrypted whole
  with a fresh IV via a new `useAppendToEntry` hook (mirrors `useSaveEntry`'s
  shape), `PATCH`ed. Mood becomes whatever's newly picked; tags become
  `[...new Set([...oldTags, ...newTags])]`. Signal detection re-runs against
  the full combined text via the existing `useSignalDetector`, which now
  hits the replace-not-accumulate route.
- **Draft autosave (`useComposerDraft`, NK-01) needs no changes** — it
  already just persists whatever's in the active text field; that's true
  regardless of append-vs-new mode.
- **Home's CTA**: label reads "Continue today's entry" vs. "New entry" based
  on `getTodaysEntry`; the link itself stays plain `/write` either way — the
  composer's own on-mount detection is what actually branches behavior, so
  Home doesn't need to duplicate that logic or pass state through the URL.
- **Entry-detail page**: a new "Add to this entry" button/link to
  `/write?entryId=${entry.id}`, rendered only when `entry` is today's own
  entry (reuses the same local-day helper).

## Explicitly out of scope

- **Editing existing text.** The old portion of the entry is read-only in
  append mode — this feature adds, it doesn't rewrite. General editing
  remains the broader, still-undecided NK-16 question if it comes up later.
- **Appending to past (non-today) entries.** Enforced server-side, not just
  hidden in the UI.
- **Removing/undoing a specific addition** once appended — same reasoning as
  "no editing": this is additive-only.
- **Multiple mood readings per entry.** `mood_score` stays a single column;
  appending with a new mood replaces the old value, it doesn't track a
  mood-over-the-day history.

## Verification plan

- Real DB round-trip against the local Supabase stack (same pattern as
  NK-03/NK-07/NK-09/NK-10 this session): apply the new migration, confirm
  `updated_at` behaves correctly on insert and on the new `PATCH`.
- Confirm the `PATCH` route genuinely rejects appending to a non-today entry
  (not just that the UI doesn't offer it).
- Confirm re-running signal detection twice against a growing entry produces
  exactly the replaced set, not accumulated duplicates.
- Confirm `buildNarrativeCacheKey` produces a different key after an
  append — i.e., that a cached playback narrative genuinely misses and
  regenerates rather than silently serving stale text.
- Full typecheck/lint/test/build sweep, matching every prior roadmap item
  this session.
- Live browser verification of the actual append flow: Home CTA label
  change, append-mode composer, save, and the entry-detail "Add to this
  entry" secondary path.
