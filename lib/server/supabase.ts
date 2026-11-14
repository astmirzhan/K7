import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { env } from './env';

let admin: SupabaseClient | null = null;

/** Secret-key client: bypasses RLS. Server only. Every query MUST filter by the caller's id. */
export function adminClient(): SupabaseClient {
  admin ??= createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

/** Cookie-based client, used only to read the signed-in user. */
export async function sessionClient(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // called from a Server Component; proxy.ts refreshes the session
        }
      },
    },
  });
}
