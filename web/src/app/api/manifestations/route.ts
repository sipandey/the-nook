/**
 * Manifestations list/create. Content is always (encrypted_text, iv) —
 * this handler never sees plaintext. category/cadence/auto_detect/status
 * are unencrypted since the list and Playback need to query on them.
 *
 * signal_count comes from a PostgREST embedded-resource count on
 * manifestation_signals — real data (0 for a fresh manifestation), not a
 * placeholder. Automatic signal *detection* — scanning new entries against
 * active manifestations — isn't built yet; see the note in
 * src/app/api/entries/route.ts POST for why that's a deliberate follow-up,
 * not an oversight.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("manifestations")
    .select("*, manifestation_signals(count)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { encryptedText, iv, category, cadence, autoDetect } = await request.json();

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("manifestations")
    .insert({
      user_id: userId,
      encrypted_text: encryptedText,
      iv,
      category: category ?? null,
      cadence: cadence ?? "ai_decides",
      auto_detect: autoDetect ?? true,
    })
    .select("id, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
