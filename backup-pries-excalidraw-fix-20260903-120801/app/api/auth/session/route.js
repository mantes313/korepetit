import { withRoute } from '@/server/handler';
import { ok } from '@/server/response';
import { createServerSupabase } from '@/lib/supabase/server';
import { ensureProfile } from '@/server/services/profiles';

export const dynamic = 'force-dynamic';

/**
 * Who am I, according to the server?
 *
 * AuthProvider used to answer this in the browser: read the session, then
 * query `profiles` directly, then upsert a row if none existed — meaning the
 * role the whole UI keyed off was assembled client-side. It is resolved here
 * now, from the cookie session and the DB.
 *
 * Returns 200 with `{ user: null }` when signed out, so the client can treat
 * "not signed in" as a normal state rather than an error.
 */
export const GET = withRoute(async () => {
  const supabase = await createServerSupabase();
  if (!supabase) return ok({ user: null, profile: null });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return ok({ user: null, profile: null });

  const user = data.user;

  let { data: profile } = await supabase
    .from('profiles')
    .select('id, role, name, photo_url')
    .eq('id', user.id)
    .maybeSingle();

  // First sign-in through an OAuth provider can land here before the
  // `handle_new_user` trigger row is visible; repair it server-side.
  if (!profile) {
    await ensureProfile({
      supabase,
      user,
      role: user.user_metadata?.role ?? 'student',
    });
    ({ data: profile } = await supabase
      .from('profiles')
      .select('id, role, name, photo_url')
      .eq('id', user.id)
      .maybeSingle());
  }

  return ok({
    user: { id: user.id, email: user.email ?? null },
    profile: profile ?? null,
  });
});
