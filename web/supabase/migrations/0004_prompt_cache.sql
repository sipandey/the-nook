-- Daily-prompt cache. See docs/ARCHITECTURE.md §10.2 / §10.6.1.
--
-- The daily prompt is currently unpersonalized (generateDailyPrompt is
-- always called with an empty entries list), so its output depends only on
-- (tone, cache_date) — every user sharing a tone on the same day would
-- otherwise trigger their own, identical-in-expectation OpenAI call. This
-- table collapses that to at most one generation per (tone, day).
--
-- cache_date is the UTC calendar date, chosen as an explicit, simple
-- boundary (§10.6.1 flagged this as ambiguous if left implicit) rather than
-- per-user local time — a user near midnight UTC may see the prompt change
-- at a time that doesn't match their local midnight; accepted for now.
--
-- template_version lets a prompt-engineering change invalidate old cache
-- rows without waiting out up to 24h of staleness — bump it when
-- TONE_SYSTEM_PROMPTS or the generation prompt in src/lib/ai/openai.ts
-- changes in a way that should produce different output.
--
-- No content here is sensitive (it's a generic reflective question, not
-- entry text), so this table is intentionally NOT scoped by user_id — it's
-- shared, not per-user, unlike every other table in this schema. The route
-- handler already requires a valid Clerk session before touching this
-- table (returns 401 otherwise); RLS below is defense in depth, not the
-- only gate — same pattern as the DELETE /api/entries/[id] comment.
create table prompt_cache (
  tone text not null,
  cache_date date not null,
  template_version smallint not null default 1,
  prompt text not null,
  created_at timestamptz not null default now(),
  primary key (tone, cache_date, template_version)
);

alter table prompt_cache enable row level security;

-- Any signed-in user may read any row (it's shared, non-sensitive content)
-- and may populate a missing row (upsert-on-conflict-do-nothing at the
-- application layer makes concurrent cache misses at day rollover safe —
-- see the route handler). A malicious authenticated caller could in
-- principle write a bogus prompt for a future (tone, date); worst case is
-- a wrong prompt string shown to users of that tone that day, not a data
-- exposure — accepted for a solo-built app, revisit if that changes.
create policy "any signed-in user can read the prompt cache"
  on prompt_cache
  for select
  using (requesting_user_id() <> '');

create policy "any signed-in user can populate the prompt cache"
  on prompt_cache
  for insert
  with check (requesting_user_id() <> '');
