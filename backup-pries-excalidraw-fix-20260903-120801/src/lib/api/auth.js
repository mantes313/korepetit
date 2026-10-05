import { getBrowserSupabase } from '@/lib/supabase/browser';
import { apiGet, apiPost } from './client';

/**
 * Auth is the one area where the browser still talks to Supabase directly:
 * the SDK owns the token lifecycle and refresh. `@supabase/ssr` persists the
 * session as cookies, which is what lets every /api route see the caller.
 *
 * Sign-up is the exception — it goes through the server so the profile row
 * is created under a validated role.
 */

function requireClient() {
  const supabase = getBrowserSupabase();
  if (!supabase) {
    throw new Error('Supabase is not configured. Add your credentials to .env.local.');
  }
  return supabase;
}

export async function registerUser({ name, email, password, role }) {
  return apiPost('/api/auth/register', { name, email, password, role });
}

export async function loginUser({ email, password }) {
  const supabase = requireClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function loginWithGoogle(role = 'student') {
  const supabase = requireClient();
  const chosenRole = role === 'teacher' ? 'teacher' : 'student';
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // Server-side route: PKCE needs the code exchanged where cookies can
      // be written. `role` rides along so a first-time Google sign-up lands
      // with the role the user picked; the callback ignores it for an
      // account that already has a profile.
      redirectTo:
        `${window.location.origin}/auth/callback` +
        `?next=%2Fdashboard&role=${chosenRole}`,
      // Calendar scope so a booked lesson can get a Meet link.
      scopes: 'https://www.googleapis.com/auth/calendar.events',
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  if (error) throw error;
}

export async function signOut() {
  const supabase = getBrowserSupabase();
  if (supabase) await supabase.auth.signOut();
}

/** Server-resolved identity: user + profile role. */
export async function fetchSession(options) {
  return apiGet('/api/auth/session', options);
}

/**
 * Google access token for the current session, if the user signed in with
 * Google. Read on demand and handed to the server for a single call rather
 * than parked in React state for the session.
 */
export async function getGoogleAccessToken() {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.provider_token ?? null;
}

/** Subscribe to sign-in / sign-out so the app can re-fetch the session. */
export function onAuthStateChange(callback) {
  const supabase = getBrowserSupabase();
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event) => callback(event));
  return () => data.subscription.unsubscribe();
}
