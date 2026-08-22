/**
 * Vercel Function: transcribes recorded audio via Whisper. Per
 * docs/ARCHITECTURE.md §6.5 and §8, raw audio is NOT persisted server-side —
 * this handler must not write the uploaded file anywhere, only forward it to
 * OpenAI and return the transcript.
 *
 * Runs on the default Node.js runtime — Next.js 16 deprecated the Edge
 * runtime, see the note in ../playback/route.ts.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { transcribeAudio } from "@/lib/ai/openai";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const audio = formData.get("audio");

  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "missing_audio" }, { status: 400 });
  }

  const text = await transcribeAudio(audio);
  return NextResponse.json({ text });
}
