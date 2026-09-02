/**
 * Vercel Function: classifies a freshly-decrypted entry against the user's
 * active manifestations. Same transient-plaintext pattern as
 * /api/ai/playback — the entry text and manifestation text arrive already
 * decrypted client-side, get used for exactly one AI call, and are never
 * logged or persisted here. Rate-limited + usage-logged (metadata only;
 * see src/lib/ai/usage.ts and docs/ARCHITECTURE.md §10.6.3).
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  detectManifestationSignals,
  TEXT_MODEL,
  type ManifestationForDetection,
} from "@/lib/ai/openai";
import { checkAiRateLimit, recordAiUsage } from "@/lib/ai/usage";
import { truncateToEntryLimit } from "@/lib/entryLimits";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { entryText: rawEntryText, manifestations } = (await request.json()) as {
    entryText: string;
    manifestations: ManifestationForDetection[];
  };

  if (!rawEntryText || !manifestations?.length) {
    return NextResponse.json({ signals: [] });
  }

  // NK-12 safety net — see the matching comment in the playback route.
  const entryText = truncateToEntryLimit(rawEntryText);

  if (!(await checkAiRateLimit(userId, "detect-signals"))) {
    return NextResponse.json({ signals: [], error: "rate_limited" }, { status: 429 });
  }

  const { signals, usage } = await detectManifestationSignals(entryText, manifestations);
  await recordAiUsage(userId, "detect-signals", TEXT_MODEL, usage);

  return NextResponse.json({ signals });
}
