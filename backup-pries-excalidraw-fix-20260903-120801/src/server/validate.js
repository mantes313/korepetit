import { z } from 'zod';
import { badRequest } from './errors';

/** Parse and validate a JSON request body. Throws ZodError -> 400. */
export async function parseBody(request, schema) {
  let raw;
  try {
    raw = await request.json();
  } catch {
    throw badRequest('Request body must be valid JSON.');
  }
  return schema.parse(raw);
}

/** Parse and validate the query string. */
export function parseQuery(request, schema) {
  const url = new URL(request.url);
  return schema.parse(Object.fromEntries(url.searchParams.entries()));
}

/** Validate a dynamic route param (Next 16: `params` is a Promise). */
export async function parseParams(ctx, schema) {
  const params = await ctx.params;
  return schema.parse(params);
}

/**
 * Shared field schemas. Every id that reaches a query is validated as a UUID
 * here — that is what closes the PostgREST filter-injection hole the old
 * `?with=<anything>` deep link opened.
 */
export const uuid = z.string().uuid('Must be a valid id.');
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD.');
export const isoTime = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Expected HH:MM.');

export { z };
