import { getAdminSupabase } from '@/lib/supabase/admin';
import { badRequest, fromSupabaseError, notFound } from '../errors';

/**
 * Column shaping.
 *
 * The old client selected `*` (and, in `attachProfiles`, explicitly asked for
 * `bank_iban` and `learning_struggles`) while RLS let any signed-in user read
 * the whole table. `security_hardening.sql` now revokes the sensitive columns
 * from the `authenticated` role outright, so:
 *
 *   - discovery columns  -> plain SELECT, listed below
 *   - your own full row  -> get_my_profile()             (SECURITY DEFINER)
 *   - a lesson partner   -> lesson_counterpart_profile() (SECURITY DEFINER)
 *
 * Both functions do their own authorisation in SQL, which means this works
 * on the caller's own JWT and needs no service-role key.
 */
export const PUBLIC_PROFILE_FIELDS = [
  'id', 'role', 'name', 'photo_url', 'headline',
  'price_60', 'price_intro', 'subjects', 'tags', 'bio', 'availability',
].join(', ');

/**
 * Fields a user may edit on their own profile.
 * `role` is absent by design, and the DB refuses it too — self-promotion
 * student -> teacher was the pivot of the privilege-escalation chain.
 */
const EDITABLE_PROFILE_FIELDS = new Set([
  'name', 'phone', 'photo_url', 'headline', 'price_60', 'price_intro',
  'subjects', 'tags', 'bio', 'availability', 'bank_iban',
  'grade', 'learning_struggles', 'expectations',
]);

function firstRow(data) {
  return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
}

export async function getOwnProfile({ supabase }) {
  const { data, error } = await supabase.rpc('get_my_profile');
  if (error) throw fromSupabaseError(error, 'Could not load your profile.');
  return firstRow(data);
}

export async function updateOwnProfile(ctx, patch) {
  const { supabase, user } = ctx;

  const clean = {};
  for (const [key, value] of Object.entries(patch)) {
    if (EDITABLE_PROFILE_FIELDS.has(key)) clean[key] = value;
  }
  if (Object.keys(clean).length === 0) {
    throw badRequest('No editable fields were provided.');
  }
  clean.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('profiles')
    .update(clean)
    .eq('id', user.id)
    .select('id')
    .maybeSingle();

  if (error) throw fromSupabaseError(error, 'Could not save your profile.');
  if (!data) throw notFound('Your profile row does not exist yet.');

  // Read back through the definer function — the columns just written are
  // not selectable by the `authenticated` role.
  return getOwnProfile(ctx);
}

export async function listTeachers({ supabase }) {
  const { data, error } = await supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_FIELDS)
    .eq('role', 'teacher')
    .order('name', { ascending: true });

  if (error) throw fromSupabaseError(error, 'Could not load tutors.');
  return data ?? [];
}

export async function getPublicProfile({ supabase }, id) {
  const { data, error } = await supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_FIELDS)
    .eq('id', id)
    .maybeSingle();

  if (error) throw fromSupabaseError(error, 'Could not load that profile.');
  if (!data) throw notFound('Profile not found.');
  return data;
}

/**
 * Students a teacher may schedule with.
 *
 * Deliberately narrower than the old `listStudents`, which handed every
 * teacher a directory of names, emails and school grades. Contact details are
 * not part of discovery; they are released per lesson, below.
 */
export async function listSchedulableStudents({ supabase }) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, photo_url, headline')
    .eq('role', 'student')
    .order('name', { ascending: true });

  if (error) throw fromSupabaseError(error, 'Could not load students.');
  return data ?? [];
}

/**
 * Contact details for the other party on a lesson.
 *
 * All of the authorisation lives in `lesson_counterpart_profile`: it verifies
 * the caller is on the lesson, and releases the IBAN only downward (a student
 * sees the teacher they owe, on an accepted lesson) and the student's
 * learning notes only upward.
 */
export async function getCounterpartDetails({ supabase }, lesson) {
  const { data, error } = await supabase.rpc('lesson_counterpart_profile', {
    p_lesson_id: lesson.id,
  });

  if (error) throw fromSupabaseError(error, 'Could not load the lesson partner.');
  return firstRow(data);
}

/**
 * Guarantee a profile row exists for a user.
 *
 * `handle_new_user` normally does this. The old client-side upsert in
 * AuthProvider existed because the trigger can be missing on a partially
 * migrated project — that repair now happens here, where `role` is trusted,
 * instead of in the browser where it could be forged. Uses the service-role
 * client when one is configured, since the row may not exist for RLS to match.
 */
export async function ensureProfile({ supabase, user, role }) {
  const client = getAdminSupabase() ?? supabase;
  const safeRole = role === 'teacher' ? 'teacher' : 'student';

  const { data: existing } = await client
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await client
    .from('profiles')
    .insert({
      id: user.id,
      role: safeRole,
      email: user.email ?? null,
      name: user.user_metadata?.full_name ?? null,
    })
    .select('id, role')
    .maybeSingle();

  if (error) throw fromSupabaseError(error, 'Could not create your profile.');
  return data;
}
