import { apiGet, apiPatch, apiUpload } from './client';

/** Your own profile, including the fields nobody else may read. */
export function getMyProfile(options) {
  return apiGet('/api/profile/me', options);
}

export function saveMyProfile(patch) {
  return apiPatch('/api/profile/me', patch);
}

/** Public card for any user. Never contains contact or payout details. */
export function getPublicProfile(userId, options) {
  return apiGet(`/api/profile/${userId}`, options);
}

export function listTeachers(options) {
  return apiGet('/api/teachers', options);
}

/** Teacher-only. Discovery fields only. */
export function listStudents(options) {
  return apiGet('/api/students', options);
}

export function uploadProfilePhoto(file) {
  const form = new FormData();
  form.append('file', file);
  return apiUpload('/api/profile/avatar', form);
}
