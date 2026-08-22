/**
 * Vercel Function: generates a playback narrative from client-decrypted
 * plaintext. This handles the "transient, never-persisted plaintext" leg of
 * docs/ARCHITECTURE.md §6.4.
 *
 * Runs on the default Node.js runtime, not Edge — Next.js 16 deprecated the
 * Edge runtime (see node_modules/next/dist/docs/.../route-segment-config/runtime.md).
 * The architecture doc's diagrams say "Edge Function" for the transient-plaintext
 * boundary this represents; treat that as "a Vercel serverless function," not
 * a literal `runtime = "edge"` requirement.
 *
 * Do not add logging of `entryPlaintexts` or the OpenAI response here —
 * that would defeat the entire point of this boundary.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generatePlaybackNarrative, type PlaybackInput } from "@/lib/ai/openai";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const input = (await request.json()) as PlaybackInput;

  if (!input.entryPlaintexts?.length) {
    return NextResponse.json({ error: "no_entries" }, { status: 400 });
  }

  const narrative = await generatePlaybackNarrative(input);
  return NextResponse.json(narrative);
}
