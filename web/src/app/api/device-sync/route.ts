/**
 * Creates a pairing session for multi-device key sync. Called by the new
 * (locked) device, which already generated the pairing id and the channel
 * key client-side — this route only registers the id so the other device
 * has somewhere to upload to. The channel key itself never appears here;
 * see docs/ARCHITECTURE.md and src/lib/deviceSync.ts for the full flow.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const SESSION_TTL_MINUTES = 5;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { pairingId } = await request.json();
  if (!pairingId) return NextResponse.json({ error: "missing_pairing_id" }, { status: 400 });

  const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60_000).toISOString();

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("device_sync_sessions")
    .insert({ pairing_id: pairingId, user_id: userId, expires_at: expiresAt });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, expiresAt }, { status: 201 });
}
