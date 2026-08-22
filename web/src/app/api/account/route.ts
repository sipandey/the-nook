/**
 * Full account deletion — wipes every row this user's data lives in
 * (there's no FK cascade set up from a "users" table, since Clerk owns
 * identity and user_id is just a plain text column here, so each table
 * needs an explicit delete) and then deletes the Clerk account itself via
 * the backend SDK.
 *
 * Order matters: delete Supabase data first, while the request's session
 * is still fully valid, and delete the Clerk user last. Deleting the Clerk
 * user is the point of no return for this handler.
 */

import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function DELETE() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await getSupabaseServerClient();

  const tables = [
    "manifestation_signals",
    "entries",
    "manifestations",
    "journal_keys",
    "notification_prefs",
  ] as const;

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId);
    if (error) {
      return NextResponse.json(
        { error: `Failed clearing ${table}: ${error.message}` },
        { status: 500 },
      );
    }
  }

  const clerk = await clerkClient();
  await clerk.users.deleteUser(userId);

  return NextResponse.json({ ok: true });
}
