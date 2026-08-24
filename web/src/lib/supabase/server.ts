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

/**
 * Service-role client — deliberately the one exception to "never bypass
 * RLS" above. There is no per-request Clerk session to scope a query to
 * when a Vercel Cron invocation calls a route: the whole point of the
 * daily-reminder job (docs/ROADMAP.md NK-10) is to read across *every*
 * user's notification_prefs and push_subscriptions, which a
 * user-token-scoped client structurally cannot do.
 *
 * Only ever call this from a route that has already verified the request
 * came from Vercel Cron (the CRON_SECRET check — see
 * src/app/api/cron/daily-reminder/route.ts) or an equivalent trusted,
 * server-only trigger. Never call it from a route reachable by a
 * browser/user request.
 */
export function getSupabaseServiceRoleClient(): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
