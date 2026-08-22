/**
 * Journal entries. The body is always already-encrypted client-side —
 * see docs/ARCHITECTURE.md §6.3. This handler never sees plaintext.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");

  const supabase = await getSupabaseServerClient();
  let query = supabase
    .from("entries")
    .select("id, created_at, mood_score, tags, encrypted_content, iv")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (since) query = query.gte("created_at", since);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

/**
 * Not yet built: after inserting the entry, checking it against the user's
 * active manifestations (auto_detect = true) and writing rows to
 * manifestation_signals. That needs the plaintext (this handler never sees
 * it) and an AI call, so it belongs client-side or in a transient function
 * the same way playback generation works (docs/ARCHITECTURE.md §6.4) — not
 * bolted onto this handler. Flagging the gap rather than leaving
 * manifestations' signal counts looking automatic when they're not yet.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { encryptedContent, iv, moodScore, tags } = await request.json();

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("entries")
    .insert({
      user_id: userId,
      encrypted_content: encryptedContent,
      iv,
      mood_score: moodScore ?? null,
      tags: tags ?? [],
    })
    .select("id, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
