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
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateDailyPrompt } from "@/lib/ai/openai";
import { DEFAULT_TONE, type Tone } from "@/lib/tone";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const tone = (searchParams.get("tone") as Tone | null) ?? DEFAULT_TONE;

  const prompt = await generateDailyPrompt(tone, []);
  return NextResponse.json({ prompt, tone });
}
