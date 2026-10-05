import { forbidden, fromSupabaseError } from '../errors';

const MESSAGE_FIELDS = 'id, sender_id, receiver_id, body, created_at, read_at';

/**
 * Messaging is gated on an *accepted* shared lesson.
 *
 * The old RLS policy accepted any shared lesson row, including a `pending`
 * one that either side could create unilaterally — which is how a fabricated
 * lesson turned into DM access. The check lives here now and is mirrored by
 * the tightened insert policy in `security_hardening.sql`.
 */
async function assertCanMessage(supabase, userId, otherId) {
  if (userId === otherId) throw forbidden('You cannot message yourself.');

  const { data, error } = await supabase
    .from('lessons')
    .select('id')
    .eq('status', 'accepted')
    .or(
      `and(student_id.eq.${userId},teacher_id.eq.${otherId}),` +
        `and(teacher_id.eq.${userId},student_id.eq.${otherId})`,
    )
    .limit(1);

  if (error) throw fromSupabaseError(error, 'Could not verify the conversation.');
  if (!data || data.length === 0) {
    throw forbidden('You can only message someone you have an accepted lesson with.');
  }
}

/**
 * Everyone the caller may talk to, with last message and unread count.
 *
 * Both ids in the filter come from the session or from a UUID-validated
 * route param, never from a raw query string — that is what closed the
 * PostgREST filter-injection hole in the old `?with=` deep link.
 */
export async function listConversations({ supabase, user }) {
  const { data: lessons, error: lessonsError } = await supabase
    .from('lessons')
    .select('student_id, teacher_id')
    .eq('status', 'accepted')
    .or(`student_id.eq.${user.id},teacher_id.eq.${user.id}`);

  if (lessonsError) {
    throw fromSupabaseError(lessonsError, 'Could not load conversations.');
  }

  const partnerIds = new Set();
  for (const lesson of lessons ?? []) {
    const other = lesson.student_id === user.id ? lesson.teacher_id : lesson.student_id;
    if (other && other !== user.id) partnerIds.add(other);
  }
  if (partnerIds.size === 0) return [];

  const ids = [...partnerIds];

  const [{ data: profiles, error: profileError }, { data: messages, error: messageError }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, name, photo_url, role, headline')
        .in('id', ids),
      supabase
        .from('messages')
        .select(MESSAGE_FIELDS)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false }),
    ]);

  if (profileError) throw fromSupabaseError(profileError, 'Could not load conversations.');
  if (messageError) throw fromSupabaseError(messageError, 'Could not load conversations.');

  const lastByPartner = new Map();
  const unreadByPartner = new Map();

  for (const message of messages ?? []) {
    const other =
      message.sender_id === user.id ? message.receiver_id : message.sender_id;
    if (!partnerIds.has(other)) continue;

    if (!lastByPartner.has(other)) lastByPartner.set(other, message);
    if (message.receiver_id === user.id && !message.read_at) {
      unreadByPartner.set(other, (unreadByPartner.get(other) ?? 0) + 1);
    }
  }

  return (profiles ?? [])
    .map((profile) => ({
      ...profile,
      lastMessage: lastByPartner.get(profile.id) ?? null,
      unread: unreadByPartner.get(profile.id) ?? 0,
    }))
    .sort((a, b) => {
      const at = a.lastMessage?.created_at ?? '';
      const bt = b.lastMessage?.created_at ?? '';
      return bt.localeCompare(at);
    });
}

export async function listThread({ supabase, user }, partnerId) {
  await assertCanMessage(supabase, user.id, partnerId);

  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_FIELDS)
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),` +
        `and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`,
    )
    .order('created_at', { ascending: true });

  if (error) throw fromSupabaseError(error, 'Could not load messages.');
  return data ?? [];
}

export async function sendMessage({ supabase, user }, { receiverId, body }) {
  await assertCanMessage(supabase, user.id, receiverId);

  const { data, error } = await supabase
    .from('messages')
    .insert({ sender_id: user.id, receiver_id: receiverId, body })
    .select(MESSAGE_FIELDS)
    .single();

  if (error) throw fromSupabaseError(error, 'Could not send the message.');
  return data;
}

/**
 * Mark a thread read.
 *
 * Scoped to rows where the caller is the receiver and only `read_at` moves.
 * The old update policy let a receiver rewrite `body` on messages sent to
 * them; the endpoint no longer accepts arbitrary columns and the policy no
 * longer allows them either.
 */
export async function markThreadRead({ supabase, user }, partnerId) {
  const { data, error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('receiver_id', user.id)
    .eq('sender_id', partnerId)
    .is('read_at', null)
    .select('id');

  if (error) throw fromSupabaseError(error, 'Could not update the conversation.');
  return { updated: data?.length ?? 0 };
}

export { MESSAGE_FIELDS };
