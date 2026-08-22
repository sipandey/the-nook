/**
 * Browser Supabase client. Auth is handled by Clerk; this client attaches the
 * Clerk session token per-request so Supabase Row-Level Security policies
 * can key off `auth.jwt()` — see the Clerk-as-third-party-auth-provider setup
 * in the Supabase dashboard (Authentication > Sign In / Providers).
 *
 * This client only ever sends/receives what's already encrypted client-side
 * (ciphertext + iv) for entry/manifestation content. It never carries the
 * DEK, the journal passphrase, or plaintext.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let browserClient: SupabaseClient<Database> | undefined;

/**
 * @param getToken - Clerk's `session.getToken()`, passed in from a component
 * so this module has no direct dependency on the Clerk client SDK.
 */
export function getSupabaseBrowserClient(
  getToken: () => Promise<string | null>,
): SupabaseClient<Database> {
  if (browserClient) return browserClient;

  browserClient = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      accessToken: async () => (await getToken()) ?? "",
    },
  );

  return browserClient;
}
