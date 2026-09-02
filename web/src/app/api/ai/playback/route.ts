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
 * that would defeat the entire point of this boundary. Rate-limited +
 * usage-logged (metadata only — route/model/token counts, never content;
 * see src/lib/ai/usage.ts and docs/ARCHITECTURE.md §10.6.3).
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generatePlaybackNarrative, TEXT_MODEL, type PlaybackInput } from "@/lib/ai/openai";
import { checkAiRateLimit, recordAiUsage } from "@/lib/ai/usage";
import { truncateToEntryLimit } from "@/lib/entryLimits";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const input = (await request.json()) as PlaybackInput;

  if (!input.entryPlaintexts?.length) {
    return NextResponse.json({ error: "no_entries" }, { status: 400 });
  }

  // NK-12 safety net, not the primary enforcement — the composer's own
  // maxLength already keeps entries within this bound by construction.
  // This exists for the case that actually matters for cost: a pre-cap
  // entry, or a bypassed client, still can't blow up a playback call.
  input.entryPlaintexts = input.entryPlaintexts.map((e) => ({
    ...e,
    text: truncateToEntryLimit(e.text),
  }));

  if (!(await checkAiRateLimit(userId, "playback"))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { narrative, usage } = await generatePlaybackNarrative(input);
  await recordAiUsage(userId, "playback", TEXT_MODEL, usage);

  return NextResponse.json(narrative);
}
