/**
 * The single door between the browser and the backend.
 *
 * Everything the UI needs now goes through /api. Nothing in `src/features`
 * talks to Supabase directly any more, except the lesson room, which needs
 * a realtime socket that cannot be proxied through REST.
 */

export class ApiClientError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** True when the user simply is not signed in. */
  get isUnauthorized() {
    return this.status === 401;
  }
}

async function request(path, { method = 'GET', body, signal, isFormData } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      signal,
      credentials: 'same-origin',
      headers: isFormData || body === undefined
        ? undefined
        : { 'Content-Type': 'application/json' },
      body: isFormData ? body : body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiClientError(0, 'network_error', 'Network error. Check your connection.');
  }

  if (response.status === 204) return null;

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiClientError(
      response.status,
      'bad_response',
      'The server returned an unexpected response.',
    );
  }

  if (!response.ok || payload?.ok === false) {
    const error = payload?.error ?? {};
    throw new ApiClientError(
      response.status,
      error.code ?? 'unknown_error',
      error.message ?? 'Request failed.',
      error.details,
    );
  }

  return payload?.data ?? null;
}

export const apiGet = (path, options) => request(path, { ...options, method: 'GET' });
export const apiPost = (path, body, options) => request(path, { ...options, method: 'POST', body });
export const apiPatch = (path, body, options) => request(path, { ...options, method: 'PATCH', body });
export const apiDelete = (path, options) => request(path, { ...options, method: 'DELETE' });

export const apiUpload = (path, formData, options) =>
  request(path, { ...options, method: 'POST', body: formData, isFormData: true });
