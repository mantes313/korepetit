import { supabase } from './supabase';

function requireSupabase() {
  if (!supabase) {
    const err = new Error('Supabase is not configured. Add your credentials to .env.local.');
    err.code = 'auth/not-configured';
    throw err;
  }
}

export async function registerUser({ name, email, password, role }) {
  requireSupabase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name, role: role ?? 'student' } },
  });
  if (error) throw error;
  return { user: data.user, session: data.session };
}

export async function loginUser({ email, password }) {
  requireSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function loginWithGoogle(role = 'student') {
  requireSupabase();
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('pendingGoogleRole', role);
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/dashboard`,
      // Calendar scope so we can create Meet-enabled events for booked lessons.
      scopes: 'https://www.googleapis.com/auth/calendar.events',
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getUserProfile(uid) {
  if (!supabase) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', uid).single();
  return data ?? null;
}

export async function saveUserProfile(uid, data) {
  if (!supabase) return;
  const { error } = await supabase.from('profiles').upsert({ id: uid, ...data });
  if (error) throw error;
}

export async function uploadProfilePhoto(uid, file) {
  if (!supabase) throw new Error('Supabase not configured');
  const path = `${uid}/avatar`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  await saveUserProfile(uid, { photo_url: data.publicUrl });
  return data.publicUrl;
}
