-- Idempotency tracking for the daily-reminder cron — see docs/ROADMAP.md
-- NK-10. Vercel's own cron docs warn invocations can be duplicated or
-- missed (best-effort delivery, no retries), so the send route has to be
-- safe to call more than once for the same day: it only sends to a user
-- whose stored date is behind today's, then advances it. A plain date
-- column on notification_prefs (one row per user already) is enough —
-- no separate tracking table needed for a single daily job.
alter table notification_prefs
  add column daily_prompt_last_sent_date date;
