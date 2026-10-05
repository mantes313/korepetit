import { badRequest, forbidden, fromSupabaseError, notFound } from '../errors';
import { PUBLIC_PROFILE_FIELDS } from './profiles';

const LESSON_FIELDS =
  'id, student_id, teacher_id, created_by, date, time, subject, notes, status, meet_link, payment_code, paid_at, created_at, updated_at';

/** Join window, enforced server-side rather than trusted from the UI. */
export const JOIN_OPENS_BEFORE_MS = 15 * 60 * 1000;
export const JOIN_CLOSES_AFTER_MS = 60 * 60 * 1000;

export async function listMyLessons({ supabase, user, profile }) {
  const column = profile?.role === 'teacher' ? 'teacher_id' : 'student_id';

  const { data, error } = await supabase
    .from('lessons')
    .select(LESSON_FIELDS)
    .eq(column, user.id)
    .order('date', { ascending: true })
    .order('time', { ascending: true });

  if (error) throw fromSupabaseError(error, 'Could not load lessons.');
  return attachCounterpartCards(supabase, data ?? [], user.id);
}

/**
 * Attach a *public* card for the other party on each lesson.
 *
 * The old `attachProfiles` pulled phone, IBAN, grade and learning struggles
 * into every list response. Lists now carry only what the list renders;
 * contact details are fetched per lesson, on demand, by an endpoint that
 * checks participation first.
 */
async function attachCounterpartCards(supabase, lessons, userId) {
  if (lessons.length === 0) return [];

  const ids = [
    ...new Set(
      lessons.map((l) => (l.student_id === userId ? l.teacher_id : l.student_id)),
    ),
  ];

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_FIELDS)
    .in('id', ids);

  if (error) throw fromSupabaseError(error, 'Could not load lesson partners.');

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return lessons.map((lesson) => {
    const isStudent = lesson.student_id === userId;
    const counterpart =
      byId.get(isStudent ? lesson.teacher_id : lesson.student_id) ?? null;
    return {
      ...lesson,
      perspective: isStudent ? 'student' : 'teacher',
      counterpart,
      // Kept so the existing feature components keep rendering unchanged.
      teacher: isStudent ? counterpart : null,
      student: isStudent ? null : counterpart,
    };
  });
}

export async function getLesson({ supabase, user }, lessonId) {
  const { data, error } = await supabase
    .from('lessons')
    .select(LESSON_FIELDS)
    .eq('id', lessonId)
    .maybeSingle();

  if (error) throw fromSupabaseError(error, 'Could not load the lesson.');
  if (!data) throw notFound('Lesson not found.');

  if (data.student_id !== user.id && data.teacher_id !== user.id) {
    // Same 404 as a missing row: never confirm that the id exists.
    throw notFound('Lesson not found.');
  }
  return data;
}

/**
 * Student books a slot with a teacher. Always lands as `pending` — status is
 * set here, never taken from the request body.
 */
export async function createLessonRequest({ supabase, user }, input) {
  const teacher = await requireProfileRole(supabase, input.teacherId, 'teacher');
  if (teacher.id === user.id) throw badRequest('You cannot book yourself.');

  const { data, error } = await supabase
    .from('lessons')
    .insert({
      student_id: user.id,
      teacher_id: teacher.id,
      created_by: user.id,
      date: input.date,
      time: input.time,
      subject: input.subject ?? null,
      notes: input.notes ?? null,
      status: 'pending',
    })
    .select(LESSON_FIELDS)
    .single();

  if (error) throw fromSupabaseError(error, 'Could not create the request.');
  return data;
}

/**
 * Teacher schedules a lesson directly.
 *
 * Still `pending`, not `accepted`. Letting a teacher mint an accepted lesson
 * against an arbitrary student id was what granted unsolicited DM rights to
 * anyone willing to flip their own role. The student has to accept now.
 */
export async function scheduleLessonAsTeacher({ supabase, user }, input) {
  const student = await requireProfileRole(supabase, input.studentId, 'student');
  if (student.id === user.id) throw badRequest('You cannot book yourself.');

  const { data, error } = await supabase
    .from('lessons')
    .insert({
      student_id: student.id,
      teacher_id: user.id,
      created_by: user.id,
      date: input.date,
      time: input.time,
      subject: input.subject ?? null,
      notes: input.notes ?? null,
      status: 'pending',
    })
    .select(LESSON_FIELDS)
    .single();

  if (error) throw fromSupabaseError(error, 'Could not schedule the lesson.');
  return data;
}

/**
 * Status transitions. Who may move a lesson where is decided here:
 *   - teacher: accept / reject a request they received
 *   - student: accept / reject a lesson their teacher proposed
 *   - either:  cancel (-> rejected) a lesson they are on
 */
export async function updateLessonStatus(ctx, lessonId, nextStatus) {
  const { supabase, user } = ctx;
  const lesson = await getLesson(ctx, lessonId);

  if (lesson.status === nextStatus) return lesson;
  if (lesson.status !== 'pending' && nextStatus !== 'rejected') {
    throw badRequest('Only a pending lesson can change to that status.');
  }

  const onLesson = lesson.teacher_id === user.id || lesson.student_id === user.id;
  if (!onLesson) throw forbidden('You are not on this lesson.');

  // Whoever proposed the lesson cannot also accept it — that would let a
  // student skip the tutor's approval, and a tutor book a student without
  // consent. Either side may reject or cancel.
  if (nextStatus === 'accepted' && lesson.created_by === user.id) {
    throw forbidden('The other party has to accept this lesson.');
  }

  const { data, error } = await supabase
    .from('lessons')
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq('id', lessonId)
    .select(LESSON_FIELDS)
    .maybeSingle();

  if (error) throw fromSupabaseError(error, 'Could not update the lesson.');
  if (!data) throw forbidden('You may not change this lesson.');
  return data;
}

/** Only the teacher may confirm they received the bank transfer. */
export async function markLessonPaid(ctx, lessonId) {
  const { supabase, user } = ctx;
  const lesson = await getLesson(ctx, lessonId);

  if (lesson.teacher_id !== user.id) {
    throw forbidden('Only the teacher can confirm payment.');
  }
  if (lesson.status !== 'accepted') {
    throw badRequest('Only an accepted lesson can be marked paid.');
  }
  if (lesson.paid_at) return lesson;

  const { data, error } = await supabase
    .from('lessons')
    .update({
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', lessonId)
    .select(LESSON_FIELDS)
    .maybeSingle();

  if (error) throw fromSupabaseError(error, 'Could not confirm payment.');
  return data;
}

/** Store the Google Meet link created when the lesson was booked. */
export async function setLessonMeetLink(ctx, lessonId, meetLink) {
  const { supabase } = ctx;
  await getLesson(ctx, lessonId);

  const { data, error } = await supabase
    .from('lessons')
    .update({ meet_link: meetLink, updated_at: new Date().toISOString() })
    .eq('id', lessonId)
    .select(LESSON_FIELDS)
    .maybeSingle();

  if (error) throw fromSupabaseError(error, 'Could not save the meeting link.');
  if (!data) throw forbidden('You may not change this lesson.');
  return data;
}

/**
 * Authoritative answer to "may I open the lesson room right now?".
 *
 * The UI still renders a countdown, but the decision is made here, so
 * navigating straight to /lessons/<id>/call outside the window gets nothing.
 */
export async function getRoomAccess(ctx, lessonId) {
  const lesson = await getLesson(ctx, lessonId);
  const startMs = Date.parse(`${lesson.date}T${normaliseTime(lesson.time)}`);
  const diff = startMs - Date.now();

  let reason = null;
  if (lesson.status === 'rejected') reason = 'rejected';
  else if (lesson.status !== 'accepted') reason = 'not_accepted';
  else if (diff > JOIN_OPENS_BEFORE_MS) reason = 'too_early';
  else if (diff < -JOIN_CLOSES_AFTER_MS) reason = 'ended';

  return {
    allowed: reason === null,
    reason,
    startsInMs: diff,
    lesson: {
      id: lesson.id,
      subject: lesson.subject,
      date: lesson.date,
      time: lesson.time,
      status: lesson.status,
      student_id: lesson.student_id,
      teacher_id: lesson.teacher_id,
    },
  };
}

function normaliseTime(time) {
  return String(time).length === 5 ? `${time}:00` : String(time);
}

async function requireProfileRole(supabase, id, role) {
  const { data } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', id)
    .maybeSingle();

  if (!data || data.role !== role) {
    throw badRequest(`That ${role} does not exist.`);
  }
  return data;
}

export { LESSON_FIELDS };
