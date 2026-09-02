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
 * Service-role client — deliberately one of two sanctioned exceptions to
 * "never bypass RLS" above, not a general-purpose escape hatch. Both
 * exist for the same underlying reason: a genuine need to read *across
 * every user*, which a user-token-scoped client structurally cannot do.
 *
 * 1. `src/app/api/cron/daily-reminder/route.ts` (docs/ROADMAP.md NK-10)
 *    — no per-request Clerk session exists at all when Vercel Cron
 *    invokes a route; the whole job is reading every user's
 *    notification_prefs and push_subscriptions. Gated on the
 *    CRON_SECRET check confirming the request actually came from Cron.
 *
 * 2. `checkAggregateSpendCeiling` (src/lib/ai/usage.ts, NK-13) — called
 *    from inside the four user-reachable /api/ai/* routes, which is why
 *    this comment no longer says "never" — but it's narrower than that
 *    blanket rule was guarding against: the aggregate dollar total it
 *    computes is used only as an internal boolean gate (call OpenAI or
 *    not) and is never returned to the client in raw or per-user form.
 *    No other user's individual rows, identity, or content are ever
 *    exposed by this path.
 *
 * Any *new* use of this client needs the same bar: a genuine
 * cross-user read, with a clear reason a user-scoped client can't do
 * the job, and no path for another user's row-level data to leak back
 * out through it.
 */
export function getSupabaseServiceRoleClient(): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
