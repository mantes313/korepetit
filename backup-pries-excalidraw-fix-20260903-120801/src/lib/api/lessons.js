import { apiGet, apiPatch, apiPost } from './client';

/**
 * One list endpoint for both roles — the server picks the right column from
 * the caller's profile, so the client no longer decides whose lessons it is
 * asking for.
 */
export function listMyLessons(options) {
  return apiGet('/api/lessons', options);
}

export function getLesson(lessonId, options) {
  return apiGet(`/api/lessons/${lessonId}`, options);
}

/** Student -> tutor. Created as pending. */
export function requestLesson({ teacherId, date, time, subject, notes }) {
  return apiPost('/api/lessons', { teacherId, date, time, subject, notes });
}

/** Tutor -> student. Also pending: the student has to accept. */
export function scheduleLesson({ studentId, date, time, subject, notes }) {
  return apiPost('/api/lessons', { studentId, date, time, subject, notes });
}

export const acceptLesson = (id) => apiPatch(`/api/lessons/${id}`, { action: 'accept' });
export const rejectLesson = (id) => apiPatch(`/api/lessons/${id}`, { action: 'reject' });
export const cancelLesson = (id) => apiPatch(`/api/lessons/${id}`, { action: 'cancel' });
export const markLessonPaid = (id) => apiPatch(`/api/lessons/${id}`, { action: 'markPaid' });

/** Contact details for the other party — fetched per lesson, on demand. */
export function getLessonCounterpart(lessonId, options) {
  return apiGet(`/api/lessons/${lessonId}/counterpart`, options);
}

/** Server decides whether the room may be opened right now. */
export function getRoomAccess(lessonId, options) {
  return apiGet(`/api/lessons/${lessonId}/access`, options);
}

/** Ask the server to create the Calendar event and store the Meet link. */
export function createMeetLink(lessonId, googleAccessToken) {
  return apiPost(`/api/lessons/${lessonId}/meet`, { googleAccessToken });
}
