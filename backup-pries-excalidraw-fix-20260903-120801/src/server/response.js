/**
 * One response envelope for the whole API, so the client never has to guess.
 *
 *   success -> { ok: true,  data: <payload> }
 *   failure -> { ok: false, error: { code, message, details? } }
 */
export function ok(data, init) {
  return Response.json({ ok: true, data: data ?? null }, init);
}

export function created(data) {
  return ok(data, { status: 201 });
}

export function noContent() {
  return new Response(null, { status: 204 });
}

export function errorResponse({ status, code, message, details }) {
  return Response.json(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}
