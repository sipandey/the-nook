-- Append-to-today's-entry (docs/ROADMAP.md NK-16 / see the design doc at
-- docs/plans/2026-08-24-append-to-todays-entry-design.md). Entries gain a
-- real update path for the first time — this column is what lets the
-- playback narrative cache (src/lib/playback/narrativeCache.ts) tell a
-- content change apart from a same-ID cache hit; see that file's updated
-- comment once buildNarrativeCacheKey changes.
alter table entries
  add column updated_at timestamptz not null default now();

-- Existing rows: updated_at should read the same as created_at, not "now"
-- (every row would otherwise look like it was just edited).
update entries set updated_at = created_at;
