/**
 * Notification preferences — entirely unencrypted (no journal content
 * here), matching notification_prefs in 0001_init.sql. No row exists until
 * the first save, so GET returns real schema defaults for a user who
 * hasn't configured anything yet rather than erroring.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const DEFAULTS = {
  daily_prompt_enabled: true,
  daily_prompt_time: "20:30:00",
  playback_ready_enabled: true,
  manifestation_enabled: false,
};

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("notification_prefs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? DEFAULTS);
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("notification_prefs")
    .upsert({ user_id: userId, ...body }, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
