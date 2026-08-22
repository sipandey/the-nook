/**
 * Vercel Function: classifies a freshly-decrypted entry against the user's
 * active manifestations. Same transient-plaintext pattern as
 * /api/ai/playback — the entry text and manifestation text arrive already
 * decrypted client-side, get used for exactly one AI call, and are never
 * logged or persisted here.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  detectManifestationSignals,
  type ManifestationForDetection,
} from "@/lib/ai/openai";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { entryText, manifestations } = (await request.json()) as {
    entryText: string;
    manifestations: ManifestationForDetection[];
  };

  if (!entryText || !manifestations?.length) {
    return NextResponse.json({ signals: [] });
  }

  const signals = await detectManifestationSignals(entryText, manifestations);
  return NextResponse.json({ signals });
}
