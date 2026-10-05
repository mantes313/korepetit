/**
 * Typed application errors.
 *
 * Route handlers throw these; `withRoute` turns them into a JSON response.
 * Anything else that escapes a handler is treated as a 500 and its message is
 * NOT sent to the client — internal failures must not leak query shapes,
 * table names, or Postgres error text.
 */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message = 'Invalid request.', details) =>
  new ApiError(400, 'bad_request', message, details);

export const unauthorized = (message = 'You must be signed in.') =>
  new ApiError(401, 'unauthorized', message);

export const forbidden = (message = 'You do not have access to this.') =>
  new ApiError(403, 'forbidden', message);

export const notFound = (message = 'Not found.') =>
  new ApiError(404, 'not_found', message);

export const conflict = (message = 'That conflicts with existing data.') =>
  new ApiError(409, 'conflict', message);

export const payloadTooLarge = (message = 'File is too large.') =>
  new ApiError(413, 'payload_too_large', message);

export const notImplemented = (message = 'Not available on this deployment.') =>
  new ApiError(501, 'not_implemented', message);

export const serviceUnavailable = (message = 'Backend is not configured.') =>
  new ApiError(503, 'service_unavailable', message);

/**
 * Map a PostgREST/Supabase error onto an ApiError. RLS denials surface as
 * empty results or 42501; either way the client gets "forbidden", never the
 * underlying policy name.
 */
export function fromSupabaseError(error, fallbackMessage = 'Request failed.') {
  if (!error) return null;
  const code = error.code ?? '';
  if (code === '42501' || code === 'PGRST301') return forbidden();
  if (code === '23505') return conflict('That record already exists.');
  if (code === '23503') return badRequest('Referenced record does not exist.');
  if (code === '23514') return badRequest('Value failed a database constraint.');
  if (code === 'PGRST116') return notFound();
  return new ApiError(500, 'internal_error', fallbackMessage);
}
