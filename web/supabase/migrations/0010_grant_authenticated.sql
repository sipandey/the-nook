-- Explicit `authenticated` role grants — same gap as 0008_grant_service_role.sql,
-- one layer up. Discovered while verifying the append-to-today's-entry PATCH
-- route (docs/plans/2026-08-24-append-to-todays-entry-design.md) against a
-- real signed JWT (role: authenticated) rather than the service-role key:
-- every query failed with "permission denied for table entries", the exact
-- same failure mode 0008 already diagnosed for service_role. BYPASSRLS
-- (service_role) and RLS policies (authenticated) both only govern *which
-- rows* a role can touch — neither one grants the underlying SQL privilege
-- to touch the table at all. Supabase's hosted platform provisions those
-- baseline grants for `authenticated` automatically; the CLI's local
-- instance, built purely by replaying this repo's own migrations, does not.
--
-- `getSupabaseServerClient()` (src/lib/supabase/server.ts) — the client
-- every route handler *except* the daily-reminder cron uses — forwards the
-- caller's Clerk-issued JWT, which PostgREST maps to this exact role. This
-- had gone undiscovered until now because no earlier verification in this
-- session's history had exercised a real authenticated write against the
-- local stack with a genuine signed JWT — service-role-based checks (0008)
-- and structural/type checks don't exercise this role at all.
--
-- Scoped to every table an authenticated per-request client can reach,
-- matching each table's own "for all"/"for select"+"for insert" RLS
-- policies from 0001/0003/0004/0005/0006 — not a blanket schema grant.
grant select, insert, update, delete on journal_keys to authenticated;
grant select, insert, update, delete on entries to authenticated;
grant select, insert, update, delete on manifestations to authenticated;
grant select, insert, update, delete on manifestation_signals to authenticated;
grant select, insert, update, delete on notification_prefs to authenticated;
grant select, insert, update, delete on device_sync_sessions to authenticated;
grant select, insert, update, delete on push_subscriptions to authenticated;
grant select, insert, update, delete on ai_usage_log to authenticated;
grant select, insert on prompt_cache to authenticated;
