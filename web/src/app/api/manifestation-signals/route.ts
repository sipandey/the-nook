/**
 * Records detected signals (no content, just pointers + a confidence
 * score — see 0001_init.sql). Called after /api/ai/detect-signals returns
 * matches; kept as a separate route rather than folded into entry creation
 * since detection is best-effort and shouldn't block or fail the save
 * itself (see the note in src/lib/hooks/useSignalDetector.ts).
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { DetectedSignal } from "@/lib/ai/openai";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { entryId, signals } = (await request.json()) as {
    entryId: string;
    signals: DetectedSignal[];
  };

  if (!entryId || !signals?.length) return NextResponse.json({ ok: true });

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("manifestation_signals").insert(
    signals.map((s) => ({
      manifestation_id: s.manifestationId,
      entry_id: entryId,
      user_id: userId,
      confidence: s.confidence,
    })),
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
