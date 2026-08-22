/**
 * Today's journaling prompt. Not personalized to entry content yet — that
 * would need recent entries decrypted client-side and sent up transiently
 * (same pattern as /api/ai/playback), which depends on the passphrase-unlock
 * flow that doesn't exist yet. generateDailyPrompt already degrades
 * gracefully with an empty summaries list, so this ships useful (if
 * generic) prompts now and gets personalization for free once unlock lands.
 *
 * Tone is hardcoded to "friend" until tone preference has somewhere to
 * live — the mockups' tone picker (OnboardingTone.dc.html, Settings.dc.html)
 * isn't backed by a database column yet. Flagging rather than guessing a
 * schema for it here.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateDailyPrompt } from "@/lib/ai/openai";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const prompt = await generateDailyPrompt("friend", []);
  return NextResponse.json({ prompt, tone: "friend" });
}
