-- NK-13: the aggregate daily spend ceiling needs to compute a real dollar
-- figure across all four /api/ai/* routes, but whisper-1 (transcribe) is
-- billed by audio duration, not tokens — ai_usage_log's existing
-- prompt_tokens/completion_tokens/total_tokens columns are meaningless for
-- that route. Adds the one column needed to price a transcribe call too.
--
-- Nullable: only ever populated for transcribe calls (the three
-- token-billed routes leave this null, same as transcribe leaves the
-- token columns null today).
alter table ai_usage_log add column duration_seconds numeric;
