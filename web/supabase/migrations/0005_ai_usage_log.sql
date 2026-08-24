-- AI usage log: cost observability + the data rate limiting reads from.
-- See docs/ARCHITECTURE.md §10.6.3 — before this, none of the four
-- /api/ai/* routes had rate limiting or usage tracking of any kind.
--
-- One row per completed AI call. Metadata only — route, model, token
-- counts, timestamp. Never the prompt, the response, or anything derived
-- from entry/manifestation plaintext; that would defeat the point of the
-- transient-plaintext boundary documented in §5/§6.4.
--
-- Doubles as the rate-limit store: a route handler counts this user's rows
-- for a given route within a trailing window before calling OpenAI, rather
-- than maintaining a separate counter table — see src/lib/ai/usage.ts.
-- Deliberately a plain Supabase table, not Vercel KV/Upstash, same
-- reasoning as prompt_cache (0004): no new vendor, and a `select count`
-- over a small per-user row set doesn't need sub-millisecond latency.
create table ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  route text not null,
  model text not null,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  created_at timestamptz not null default now()
);

-- Rate-limit checks filter by (user_id, route, created_at); this index
-- covers that query directly.
create index ai_usage_log_user_route_created_idx
  on ai_usage_log (user_id, route, created_at desc);

alter table ai_usage_log enable row level security;

-- Same shape as every other per-user table in this schema (entries,
-- manifestations, ...): scoped to the owning user, both directions.
create policy "users manage their own ai usage log"
  on ai_usage_log
  for all
  using (user_id = requesting_user_id())
  with check (user_id = requesting_user_id());
