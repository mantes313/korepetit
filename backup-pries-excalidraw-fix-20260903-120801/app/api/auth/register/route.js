import { withRoute } from '@/server/handler';
import { created } from '@/server/response';
import { createServerSupabase } from '@/lib/supabase/server';
import { badRequest, serviceUnavailable, ApiError } from '@/server/errors';
import { parseBody, z } from '@/server/validate';
import { ensureProfile } from '@/server/services/profiles';

export const dynamic = 'force-dynamic';

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(120),
  email: z.string().trim().email('Enter a valid email address.').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
  role: z.enum(['student', 'teacher']).default('student'),
});

/**
 * Sign-up runs on the server so the session lands in an httpOnly cookie and
 * the profile row is created under a role the server has validated.
 *
 * Role is still the user's choice at sign-up — that is the product — but it
 * is fixed from here on: `/api/profile/me` will not change it.
 */
export const POST = withRoute(async (request) => {
  const supabase = await createServerSupabase();
  if (!supabase) throw serviceUnavailable('Supabase is not configured.');

  const { name, email, password, role } = await parseBody(request, registerSchema);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name, role } },
  });

  if (error) {
    // Supabase distinguishes "already registered"; everything else is generic.
    if (/already registered/i.test(error.message)) {
      throw badRequest('That email address is already registered.');
    }
    throw new ApiError(400, 'signup_failed', error.message);
  }

  if (data.user && data.session) {
    await ensureProfile({ supabase, user: data.user, role });
  }

  return created({
    userId: data.user?.id ?? null,
    // False when the project has email confirmation switched on.
    signedIn: Boolean(data.session),
  });
});
