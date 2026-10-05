import { supabase } from './supabase';

const VALID_STATUSES = ['pending', 'accepted', 'rejected'];

function requireSupabase() {
  if (!supabase) {
    const err = new Error('Supabase is not configured. Add your credentials to .env.local.');
    err.code = 'lessons/not-configured';
    throw err;
  }
}

export async function listTeachers() {
  requireSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, headline, photo_url, subjects, tags, price_60, bio, availability')
    .eq('role', 'teacher')
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getTeacher(id) {
  requireSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, headline, photo_url, subjects, tags, price_60, bio, role')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.role !== 'teacher') return null;
  return data;
}

export async function listStudents() {
  requireSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, photo_url, grade')
    .eq('role', 'student')
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createLessonAsTeacher({ teacherId, studentId, date, time, subject, notes }) {
  requireSupabase();
  if (!studentId || !teacherId || !date || !time) {
    throw new Error('Student, teacher, date, and time are required.');
  }
  const { data, error } = await supabase
    .from('lessons')
    .insert({
      student_id: studentId,
      teacher_id: teacherId,
      date,
      time,
      subject: subject?.trim() || null,
      notes: notes?.trim() || null,
      status: 'accepted',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createLessonRequest({ studentId, teacherId, date, time, subject, notes }) {
  requireSupabase();
  if (!studentId || !teacherId || !date || !time) {
    throw new Error('Student, teacher, date, and time are required.');
  }
  const { data, error } = await supabase
    .from('lessons')
    .insert({
      student_id: studentId,
      teacher_id: teacherId,
      date,
      time,
      subject: subject?.trim() || null,
      notes: notes?.trim() || null,
      status: 'pending',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function attachProfiles(lessons, key) {
  if (!lessons.length) return lessons;
  const ids = [...new Set(lessons.map(l => l[key]))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, email, phone, photo_url, headline, subjects, tags, price_60, bio, grade, learning_struggles, expectations, bank_iban')
    .in('id', ids);
  const map = new Map((profiles ?? []).map(p => [p.id, p]));
  const field = key === 'teacher_id' ? 'teacher' : 'student';
  return lessons.map(l => ({ ...l, [field]: map.get(l[key]) ?? null }));
}

export async function listLessonsForStudent(studentId) {
  requireSupabase();
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('student_id', studentId)
    .order('date', { ascending: true })
    .order('time', { ascending: true });
  if (error) throw error;
  return attachProfiles(data ?? [], 'teacher_id');
}

export async function listLessonsForTeacher(teacherId) {
  requireSupabase();
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('date', { ascending: true })
    .order('time', { ascending: true });
  if (error) throw error;
  return attachProfiles(data ?? [], 'student_id');
}

export async function setLessonMeetLink(lessonId, meetLink) {
  requireSupabase();
  const { data, error } = await supabase
    .from('lessons')
    .update({ meet_link: meetLink, updated_at: new Date().toISOString() })
    .eq('id', lessonId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markLessonPaid(lessonId) {
  requireSupabase();
  const { data, error } = await supabase
    .from('lessons')
    .update({ paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', lessonId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateLessonStatus(lessonId, status) {
  requireSupabase();
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }
  const { data, error } = await supabase
    .from('lessons')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', lessonId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
