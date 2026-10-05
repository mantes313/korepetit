import { apiGet, apiPatch, apiPost } from './client';

export function listConversations(options) {
  return apiGet('/api/messages', options);
}

export function listThread(partnerId, options) {
  return apiGet(`/api/messages/${partnerId}`, options);
}

export function sendMessage({ receiverId, body }) {
  return apiPost('/api/messages', { receiverId, body });
}

export function markThreadRead(partnerId) {
  return apiPatch(`/api/messages/${partnerId}`);
}
