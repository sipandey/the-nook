/**
 * Records detected signals (no content, just pointers + a confidence
 * score — see 0001_init.sql). Called after /api/ai/detect-signals returns
 * matches; kept as a separate route rather than folded into entry creation
 * since detection is best-effort and shouldn't block or fail the save
 * itself (see the note in src/lib/hooks/useSignalDetector.ts).
 *
 * Replaces, not accumulates: appending to today's entry
 * (docs/plans/2026-08-24-append-to-todays-entry-design.md) re-runs
 * detection against the full updated text, so a prior call for the same
 * entry_id is now stale, not additive — inserting on top of it would
 * double-count the same manifestation and break the "the signal count
 * means something" invariant (ARCHITECTURE.md). Existing rows for the
 * entry are cleared first, but only once there's something to replace
 * them with — a zero-signal result shouldn't wipe a real prior detection
 * just because this particular call found nothing.
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

  const { error: deleteError } = await supabase
    .from("manifestation_signals")
    .delete()
    .eq("entry_id", entryId)
    .eq("user_id", userId);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

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
