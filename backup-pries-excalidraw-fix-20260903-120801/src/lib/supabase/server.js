import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { publicEnv, isSupabaseConfigured } from '../env';

/**
 * Request-scoped Supabase client that acts *as the signed-in user*.
 *
 * It reads the session from the request cookies, so every query still runs
 * under that user's RLS policies. This is the default client for route
 * handlers: the server adds authorisation and shaping on top, and RLS stays
 * underneath as a second line of defence.
 *
 * Must be created per request — never cached in a module-level variable.
 */
export async function createServerSupabase() {
  if (!isSupabaseConfigured) return null;

  const cookieStore = await cookies();

  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render, where cookies are
          // read-only. Safe to ignore: token refresh is also handled by the
          // browser client and by route handlers, which can write.
        }
      },
    },
  });
}
