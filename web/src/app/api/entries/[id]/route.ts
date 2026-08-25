/**
 * Single-entry operations. GET-by-id isn't needed yet — the entry detail
 * screen reads from the already-fetched entries list in the TanStack Query
 * cache (see src/app/(app)/journal/[id]/page.tsx) rather than a fresh
 * network round trip.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  // RLS already scopes this to the caller's own rows; the explicit
  // user_id filter is defense in depth, not the only thing enforcing it.
  const { error } = await supabase
    .from("entries")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/**
 * Appends to today's own entry — see docs/plans/2026-08-24-append-to-
 * todays-entry-design.md. The body is already the *combined* re-encrypted
 * plaintext (existing text + the new addition) — this handler never sees
 * plaintext, same as POST /api/entries. Rejects outright if the target
 * entry isn't from today: appending to a past entry is out of scope, not
 * just unavailable in the UI — enforcing it here, not just client-side,
 * matters because a client is never trusted for authorization.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const { encryptedContent, iv, moodScore, tags } = await request.json();

  const supabase = await getSupabaseServerClient();

  const { data: existing, error: fetchError } = await supabase
    .from("entries")
    .select("created_at")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const entryDate = new Date(existing.created_at);
  const now = new Date();
  const isToday =
    entryDate.getFullYear() === now.getFullYear() &&
    entryDate.getMonth() === now.getMonth() &&
    entryDate.getDate() === now.getDate();
  if (!isToday) {
    return NextResponse.json({ error: "not_todays_entry" }, { status: 403 });
  }

  const { error } = await supabase
    .from("entries")
    .update({
      encrypted_content: encryptedContent,
      iv,
      mood_score: moodScore ?? null,
      tags: tags ?? [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
