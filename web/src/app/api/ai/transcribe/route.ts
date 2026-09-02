/**
 * Vercel Function: transcribes recorded audio via Whisper. Per
 * docs/ARCHITECTURE.md §6.5 and §8, raw audio is NOT persisted server-side —
 * this handler must not write the uploaded file anywhere, only forward it to
 * OpenAI and return the transcript.
 *
 * Runs on the default Node.js runtime — Next.js 16 deprecated the Edge
 * runtime, see the note in ../playback/route.ts.
 *
 * Rate-limited + usage-logged (metadata only — never the audio or the
 * transcript; see src/lib/ai/usage.ts and docs/ARCHITECTURE.md §10.6.3).
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { transcribeAudio, TRANSCRIBE_MODEL } from "@/lib/ai/openai";
import { checkAiRateLimit, checkAggregateSpendCeiling, recordAiUsage } from "@/lib/ai/usage";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const audio = formData.get("audio");

  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "missing_audio" }, { status: 400 });
  }

  if (!(await checkAiRateLimit(userId, "transcribe"))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // NK-13 — see the matching comment in the playback route on why this
  // is a distinct error code from rate_limited above.
  if (!(await checkAggregateSpendCeiling())) {
    return NextResponse.json({ error: "spend_ceiling_reached" }, { status: 429 });
  }

  const { text, usage } = await transcribeAudio(audio);
  await recordAiUsage(userId, "transcribe", TRANSCRIBE_MODEL, usage);

  return NextResponse.json({ text });
}
