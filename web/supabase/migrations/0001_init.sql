-- The Nook — initial schema
-- Mirrors docs/ARCHITECTURE.md §4 (data model) and §5 (encryption architecture).
--
-- Identity note: `user_id` throughout is the Clerk user ID (text), not a
-- Supabase auth.users row — Clerk is the identity provider, connected here
-- as a third-party auth provider so RLS can key off auth.jwt()->>'sub'.
-- Configure that connection in the Supabase dashboard before applying RLS
-- policies that reference `requesting_user_id()` below.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helper: extract the Clerk user id from the request's verified JWT.
-- ---------------------------------------------------------------------------
create or replace function requesting_user_id()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt()->>'sub', '')
$$;

-- ---------------------------------------------------------------------------
-- journal_keys — one row per user. Never contains plaintext, the passphrase,
-- the recovery code, or the raw DEK. See docs/ARCHITECTURE.md §5.
-- ---------------------------------------------------------------------------
create table journal_keys (
  user_id text primary key,
  wrapped_dek bytea not null,
  wrapped_dek_iv bytea not null,
  wrapped_dek_salt bytea not null,
  wrapped_dek_recovery bytea not null,
  wrapped_dek_recovery_iv bytea not null,
  wrapped_dek_recovery_salt bytea not null,
  kdf_params jsonb not null default '{"algorithm":"argon2id","iterations":3,"memorySize":65536,"parallelism":1}',
  created_at timestamptz not null default now()
);

alter table journal_keys enable row level security;

create policy "users manage their own key material"
  on journal_keys
  for all
  using (user_id = requesting_user_id())
  with check (user_id = requesting_user_id());

-- ---------------------------------------------------------------------------
-- entries — content is always (encrypted_content, iv). Only the metadata a
-- query genuinely needs is stored in the clear: mood, tags, timestamps.
-- ---------------------------------------------------------------------------
create table entries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  created_at timestamptz not null default now(),
  mood_score smallint check (mood_score between 1 and 5),
  tags text[] not null default '{}',
  encrypted_content bytea not null,
  iv bytea not null
);

create index entries_user_created_idx on entries (user_id, created_at desc);

alter table entries enable row level security;

create policy "users manage their own entries"
  on entries
  for all
  using (user_id = requesting_user_id())
  with check (user_id = requesting_user_id());

-- ---------------------------------------------------------------------------
-- manifestations — goal text is encrypted; cadence/status/category are not,
-- since Playback and the list view need to query on them.
-- ---------------------------------------------------------------------------
create table manifestations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  created_at timestamptz not null default now(),
  category text,
  cadence text not null default 'ai_decides' check (cadence in ('weekly', 'monthly', 'ai_decides')),
  auto_detect boolean not null default true,
  status text not null default 'active' check (status in ('active', 'archived')),
  encrypted_text bytea not null,
  iv bytea not null
);

create index manifestations_user_status_idx on manifestations (user_id, status);

alter table manifestations enable row level security;

create policy "users manage their own manifestations"
  on manifestations
  for all
  using (user_id = requesting_user_id())
  with check (user_id = requesting_user_id());

-- ---------------------------------------------------------------------------
-- manifestation_signals — AI-detected links between an entry and a
-- manifestation. No content lives here, only a confidence score and pointers.
-- ---------------------------------------------------------------------------
create table manifestation_signals (
  id uuid primary key default gen_random_uuid(),
  manifestation_id uuid not null references manifestations (id) on delete cascade,
  entry_id uuid not null references entries (id) on delete cascade,
  user_id text not null,
  detected_at timestamptz not null default now(),
  confidence real not null check (confidence between 0 and 1)
);

create index manifestation_signals_manifestation_idx on manifestation_signals (manifestation_id);

alter table manifestation_signals enable row level security;

create policy "users manage their own manifestation signals"
  on manifestation_signals
  for all
  using (user_id = requesting_user_id())
  with check (user_id = requesting_user_id());

-- ---------------------------------------------------------------------------
-- notification_prefs — one row per user, unencrypted (no journal content).
-- ---------------------------------------------------------------------------
create table notification_prefs (
  user_id text primary key,
  daily_prompt_enabled boolean not null default true,
  daily_prompt_time time not null default '20:30',
  playback_ready_enabled boolean not null default true,
  manifestation_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table notification_prefs enable row level security;

create policy "users manage their own notification prefs"
  on notification_prefs
  for all
  using (user_id = requesting_user_id())
  with check (user_id = requesting_user_id());
