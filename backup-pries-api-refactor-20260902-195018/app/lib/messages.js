import { supabase } from './supabase';

function requireSupabase() {
  if (!supabase) {
    const err = new Error('Supabase is not configured. Add your credentials to .env.local.');
    err.code = 'messages/not-configured';
    throw err;
  }
}

export async function listConversationPartners(userId) {
  requireSupabase();
  if (!userId) return [];

  const { data: lessons, error: lessonsErr } = await supabase
    .from('lessons')
    .select('student_id, teacher_id')
    .or(`student_id.eq.${userId},teacher_id.eq.${userId}`);
  if (lessonsErr) throw lessonsErr;

  const partnerIds = new Set();
  for (const l of lessons ?? []) {
    const other = l.student_id === userId ? l.teacher_id : l.student_id;
    if (other) partnerIds.add(other);
  }
  if (partnerIds.size === 0) return [];

  const ids = [...partnerIds];
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, name, photo_url, role, headline')
    .in('id', ids);
  if (profErr) throw profErr;

  const { data: msgs, error: msgErr } = await supabase
    .from('messages')
    .select('id, sender_id, receiver_id, body, created_at, read_at')
    .or(
      ids.map(id =>
        `and(sender_id.eq.${userId},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${userId})`
      ).join(',')
    )
    .order('created_at', { ascending: false });
  if (msgErr) throw msgErr;

  const lastByPartner = new Map();
  const unreadByPartner = new Map();
  for (const m of msgs ?? []) {
    const other = m.sender_id === userId ? m.receiver_id : m.sender_id;
    if (!lastByPartner.has(other)) lastByPartner.set(other, m);
    if (m.receiver_id === userId && !m.read_at) {
      unreadByPartner.set(other, (unreadByPartner.get(other) ?? 0) + 1);
    }
  }

  return (profiles ?? [])
    .map(p => ({
      ...p,
      lastMessage: lastByPartner.get(p.id) ?? null,
      unread: unreadByPartner.get(p.id) ?? 0,
    }))
    .sort((a, b) => {
      const at = a.lastMessage?.created_at ?? '';
      const bt = b.lastMessage?.created_at ?? '';
      return bt.localeCompare(at);
    });
}

export async function listMessagesWith(userId, otherId) {
  requireSupabase();
  if (!userId || !otherId) return [];
  const { data, error } = await supabase
    .from('messages')
    .select('id, sender_id, receiver_id, body, created_at, read_at')
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${userId})`
    )
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function sendMessage({ senderId, receiverId, body }) {
  requireSupabase();
  const trimmed = body?.trim();
  if (!senderId || !receiverId) throw new Error('Sender and receiver are required.');
  if (!trimmed) throw new Error('Message cannot be empty.');
  if (trimmed.length > 2000) throw new Error('Message is too long (max 2000 characters).');

  const { data, error } = await supabase
    .from('messages')
    .insert({ sender_id: senderId, receiver_id: receiverId, body: trimmed })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markConversationRead(userId, otherId) {
  requireSupabase();
  if (!userId || !otherId) return;
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('receiver_id', userId)
    .eq('sender_id', otherId)
    .is('read_at', null);
  if (error) throw error;
}

export async function getProfileBrief(userId) {
  requireSupabase();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, photo_url, role, headline')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
