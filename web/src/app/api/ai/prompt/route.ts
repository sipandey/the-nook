/**
 * Today's journaling prompt. Not personalized to entry content yet — that
 * would need recent entries decrypted client-side and sent up transiently,
 * same pattern as /api/ai/playback. The unlock flow this depends on now
 * exists (src/components/unlock/), so personalization is a real follow-up,
 * not blocked on anything structural anymore — generateDailyPrompt already
 * degrades gracefully with an empty summaries list in the meantime.
 *
 * Tone comes from the client via ?tone=, sourced from Clerk's
 * unsafeMetadata (src/lib/hooks/useTone.ts) — this route doesn't look it
 * up itself since Clerk user data isn't queryable server-side without an
 * extra API call this doesn't need.
 *
 * Cached by (tone, UTC calendar date, template version) — see
 * docs/ARCHITECTURE.md §10.2/§10.6.1. Because the prompt is unpersonalized,
 * this is valid to share across every user with the same tone on the same
 * day; the moment personalization ships, this caching scheme stops being
 * correct and must be revisited (it would need to become per-user, and per
 * §5 point 2, re-encrypted before being persisted).
 *
 * Deliberately NOT edge/CDN-cached (no Cache-Control: public header): this
 * route is gated by the auth() check below, and a CDN-level cache would
 * mean cached hits never re-run that check — i.e. it would turn into an
 * unauthenticated read path. The Supabase-backed cache below still cuts
 * OpenAI calls to at most one per (tone, day); it just costs one DB round
 * trip per request instead of a free CDN hit.
 *
 * Rate-limited + usage-logged (docs/ARCHITECTURE.md §10.6.3) — but only on
 * a cache miss: a cache hit costs nothing, so it shouldn't count against a
 * limit meant to bound OpenAI spend.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateDailyPrompt, DAILY_PROMPT_TEMPLATE_VERSION, TEXT_MODEL } from "@/lib/ai/openai";
import { checkAiRateLimit, recordAiUsage } from "@/lib/ai/usage";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_TONE, type Tone } from "@/lib/tone";

const UNIQUE_VIOLATION = "23505";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const tone = (searchParams.get("tone") as Tone | null) ?? DEFAULT_TONE;

  // UTC calendar date, chosen as an explicit, simple day boundary rather
  // than per-user local time — see the migration's comment for why.
  const cacheDate = new Date().toISOString().slice(0, 10);

  const supabase = await getSupabaseServerClient();

  const { data: cached } = await supabase
    .from("prompt_cache")
    .select("prompt")
    .eq("tone", tone)
    .eq("cache_date", cacheDate)
    .eq("template_version", DAILY_PROMPT_TEMPLATE_VERSION)
    .maybeSingle();

  if (cached?.prompt) {
    return NextResponse.json({ prompt: cached.prompt, tone });
  }

  if (!(await checkAiRateLimit(userId, "prompt"))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { prompt, usage } = await generateDailyPrompt(tone, []);
  await recordAiUsage(userId, "prompt", TEXT_MODEL, usage);

  const { error: insertError } = await supabase.from("prompt_cache").insert({
    tone,
    cache_date: cacheDate,
    template_version: DAILY_PROMPT_TEMPLATE_VERSION,
    prompt,
  });

  if (insertError?.code === UNIQUE_VIOLATION) {
    // A concurrent request for the same (tone, day) already won the race
    // and inserted first — the unique constraint is what makes this
    // single-flight, not application-level locking. Serve whichever
    // prompt landed first rather than our own, so every caller for this
    // (tone, day) converges on the same cached text.
    const { data: winning } = await supabase
      .from("prompt_cache")
      .select("prompt")
      .eq("tone", tone)
      .eq("cache_date", cacheDate)
      .eq("template_version", DAILY_PROMPT_TEMPLATE_VERSION)
      .maybeSingle();
    return NextResponse.json({ prompt: winning?.prompt ?? prompt, tone });
  }

  // Any other insert error (including none) shouldn't fail the request —
  // the prompt was already generated successfully; caching it is a bonus,
  // not a requirement.
  return NextResponse.json({ prompt, tone });
}
