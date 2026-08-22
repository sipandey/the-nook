/**
 * Server-side Supabase client for use inside Route Handlers / Edge Functions.
 * Forwards the caller's Clerk session token so RLS policies apply exactly as
 * they would for the browser client — this is not a service-role client and
 * must never bypass RLS.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import type { Database } from "./types";

export async function getSupabaseServerClient(): Promise<
  SupabaseClient<Database>
> {
  const { getToken } = await auth();

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      accessToken: async () => (await getToken()) ?? "",
    },
  );
}
