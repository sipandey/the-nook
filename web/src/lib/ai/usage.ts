/**
 * Rate limiting + usage logging for the four /api/ai/* routes. See
 * docs/ARCHITECTURE.md §10.6.3 — before this, none of them had either.
 *
 * Deliberately separate from src/lib/ai/openai.ts: that module's job is
 * "talk to OpenAI, return content" and stays free of DB/auth concerns (see
 * its own header comment). This module's job is "who is this for, and
 * should we let them" — same split as the route handlers already have
 * (auth lives in the route, not in openai.ts).
 *
 * Only ever logs metadata (route, model, token counts) — never the prompt
 * or the response. Logging/rate-limit failures never break the actual
 * feature: both functions fail open, matching the "don't fail the request
 * over a caching problem" stance already used in /api/ai/prompt.
 */

import "server-only";
import { getSupabaseServerClient, getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { computeCallCostUsd } from "./cost";

export type AiRoute = "prompt" | "playback" | "detect-signals" | "transcribe";

export interface AiUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  /** whisper-1 only — bills by audio duration, not tokens. See NK-13's
   *  migration 0011_ai_usage_log_duration.sql. */
  durationSeconds?: number;
}

/**
 * Generous per-route ceilings — this is a personal journaling app, not a
 * bulk API. The point is bounding worst-case cost from a bug or a scripted
 * client, not constraining normal use; none of these should ever trigger
 * for someone using the app as designed.
 */
const RATE_LIMITS: Record<AiRoute, { max: number; windowMinutes: number }> = {
  prompt: { max: 30, windowMinutes: 60 },
  playback: { max: 20, windowMinutes: 60 },
  "detect-signals": { max: 60, windowMinutes: 60 },
  transcribe: { max: 30, windowMinutes: 60 },
};

/**
 * Returns true if the caller is under their limit for this route. Checked
 * immediately before the OpenAI call, not before a cache lookup — a cache
 * hit costs nothing, so it shouldn't count against a limit meant to bound
 * OpenAI spend (see /api/ai/prompt, which only checks this on cache miss).
 *
 * Fails open: if the count query itself errors, this returns true rather
 * than blocking a legitimate request over an unrelated DB hiccup.
 */
export async function checkAiRateLimit(userId: string, route: AiRoute): Promise<boolean> {
  const { max, windowMinutes } = RATE_LIMITS[route];
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();

  const supabase = await getSupabaseServerClient();
  const { count, error } = await supabase
    .from("ai_usage_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("route", route)
    .gte("created_at", since);

  if (error) return true;
  return (count ?? 0) < max;
}

/**
 * NK-13 — bounds total OpenAI spend across *every* user, not just one
 * user's own hourly rate (that's what checkAiRateLimit already does).
 * Requires the service-role client, since this is a genuine cross-user
 * read — see the "sanctioned exceptions" comment on
 * getSupabaseServiceRoleClient in src/lib/supabase/server.ts for why
 * that's safe to do from a route reachable by a browser/user request in
 * this one specific, narrow case.
 *
 * $1/day by default, overridable via AI_DAILY_SPEND_CEILING_USD — this
 * is a personal-scale app today, but the exact dollar comfort level is
 * a product call, not something to hardcode past a config point. UTC
 * calendar day, matching the daily-prompt cache's existing day-boundary
 * convention (docs/ARCHITECTURE.md §10.6.1) rather than a rolling
 * window, for the same reason: simple and explicit beats precise.
 *
 * Fails open, same as checkAiRateLimit: a DB hiccup degrades to
 * "allow the call," never to blocking a legitimate request.
 */
export async function checkAggregateSpendCeiling(): Promise<boolean> {
  const ceilingUsd = Number(process.env.AI_DAILY_SPEND_CEILING_USD ?? "1");
  const startOfUtcDay = new Date();
  startOfUtcDay.setUTCHours(0, 0, 0, 0);

  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("ai_usage_log")
    .select("model, prompt_tokens, completion_tokens, duration_seconds")
    .gte("created_at", startOfUtcDay.toISOString());

  if (error) return true;

  const totalSpentUsd = (data ?? []).reduce(
    (sum, row) =>
      sum +
      computeCallCostUsd(row.model, {
        promptTokens: row.prompt_tokens ?? undefined,
        completionTokens: row.completion_tokens ?? undefined,
        durationSeconds: row.duration_seconds ?? undefined,
      }),
    0,
  );

  return totalSpentUsd < ceilingUsd;
}

/**
 * Records one completed call. Best-effort — awaited so it completes before
 * the function returns (Vercel Functions don't guarantee post-response
 * work), but its result is never surfaced to the caller; a logging failure
 * must not turn a successful AI call into a failed request.
 */
export async function recordAiUsage(
  userId: string,
  route: AiRoute,
  model: string,
  usage?: AiUsage,
): Promise<void> {
  try {
    const supabase = await getSupabaseServerClient();
    await supabase.from("ai_usage_log").insert({
      user_id: userId,
      route,
      model,
      prompt_tokens: usage?.promptTokens ?? null,
      completion_tokens: usage?.completionTokens ?? null,
      total_tokens: usage?.totalTokens ?? null,
      duration_seconds: usage?.durationSeconds ?? null,
    });
  } catch {
    // Metadata logging is a bonus, not a requirement — see module comment.
  }
}
