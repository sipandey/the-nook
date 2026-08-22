/**
 * GET: polled by the new (locked) device waiting for the handoff.
 * PATCH: called once by the already-unlocked device to complete it.
 *
 * Both sides authenticate via Clerk; PATCH additionally checks the
 * session's stored user_id matches the caller, so pairing only completes
 * within the same account even if a pairing id leaked. GET deletes the row
 * after a successful pickup — this is meant to be used exactly once.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pairingId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { pairingId } = await params;
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("device_sync_sessions")
    .select("*")
    .eq("pairing_id", pairingId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || new Date(data.expires_at as string) < new Date()) {
    return NextResponse.json({ error: "expired" }, { status: 404 });
  }

  if (!data.encrypted_dek) {
    return NextResponse.json({ pending: true });
  }

  // Single-use: delete now that the payload has been picked up.
  await supabase.from("device_sync_sessions").delete().eq("pairing_id", pairingId);

  return NextResponse.json({
    encryptedDek: data.encrypted_dek,
    encryptedDekIv: data.encrypted_dek_iv,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ pairingId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { pairingId } = await params;
  const { encryptedDek, encryptedDekIv } = await request.json();

  const supabase = await getSupabaseServerClient();

  const { data: session, error: fetchError } = await supabase
    .from("device_sync_sessions")
    .select("user_id, expires_at")
    .eq("pairing_id", pairingId)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!session || session.user_id !== userId || new Date(session.expires_at as string) < new Date()) {
    return NextResponse.json({ error: "expired_or_not_found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("device_sync_sessions")
    .update({ encrypted_dek: encryptedDek, encrypted_dek_iv: encryptedDekIv })
    .eq("pairing_id", pairingId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
