/**
 * Single-entry operations. GET-by-id isn't needed yet — the entry detail
 * screen reads from the already-fetched entries list in the TanStack Query
 * cache (see src/app/(app)/journal/[id]/page.tsx) rather than a fresh
 * network round trip. Delete is the one operation that genuinely needs its
 * own endpoint.
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
