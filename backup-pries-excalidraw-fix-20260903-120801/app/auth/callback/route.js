import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { ensureProfile } from '@/server/services/profiles';

export const dynamic = 'force-dynamic';

/**
 * OAuth redirect target.
 *
 * `@supabase/ssr` uses the PKCE flow, so the provider sends back a `code`
 * that has to be exchanged for a session here, on the server, where the
 * resulting cookies can be written.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const nextPath = safeRedirect(url.searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=oauth', url.origin));
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    return NextResponse.redirect(new URL('/login?error=config', url.origin));
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('[auth] code exchange failed:', error.message);
    return NextResponse.redirect(new URL('/login?error=oauth', url.origin));
  }

  // Seed the profile on first Google sign-in. `ensureProfile` returns the
  // existing row untouched when there is one, so the `role` query param can
  // only ever set the role for a brand-new account — it cannot promote an
  // existing student.
  if (data?.user) {
    const requestedRole = url.searchParams.get('role');
    try {
      await ensureProfile({
        supabase,
        user: data.user,
        role: requestedRole === 'teacher' ? 'teacher' : 'student',
      });
    } catch (seedError) {
      console.error('[auth] profile seed failed:', seedError);
    }
  }

  return NextResponse.redirect(new URL(nextPath, url.origin));
}

/** Only same-site relative paths, so `next` cannot become an open redirect. */
function safeRedirect(value) {
  if (typeof value !== 'string') return '/dashboard';
  if (!value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  return value;
}
