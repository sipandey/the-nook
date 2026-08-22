import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const { encryptedText, iv, category, cadence, autoDetect, status } = await request.json();

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("manifestations")
    .update({
      ...(encryptedText !== undefined && { encrypted_text: encryptedText }),
      ...(iv !== undefined && { iv }),
      ...(category !== undefined && { category }),
      ...(cadence !== undefined && { cadence }),
      ...(autoDetect !== undefined && { auto_detect: autoDetect }),
      ...(status !== undefined && { status }),
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("manifestations")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
