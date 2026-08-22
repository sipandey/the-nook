/**
 * Stores/fetches wrapped key material for the signed-in user. Never touches
 * plaintext, the passphrase, the recovery code, or an unwrapped DEK — those
 * exist only in the browser. See docs/ARCHITECTURE.md §6.1 and §6.2.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("journal_keys")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  // Expected shape mirrors WrappedKeyMaterial from src/lib/crypto, doubled
  // up for the passphrase-wrapped and recovery-wrapped copies of the DEK.
  const {
    wrappedDek,
    wrappedDekIv,
    wrappedDekSalt,
    wrappedDekRecovery,
    wrappedDekRecoveryIv,
    wrappedDekRecoverySalt,
  } = body;

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("journal_keys").insert({
    user_id: userId,
    wrapped_dek: wrappedDek,
    wrapped_dek_iv: wrappedDekIv,
    wrapped_dek_salt: wrappedDekSalt,
    wrapped_dek_recovery: wrappedDekRecovery,
    wrapped_dek_recovery_iv: wrappedDekRecoveryIv,
    wrapped_dek_recovery_salt: wrappedDekRecoverySalt,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
