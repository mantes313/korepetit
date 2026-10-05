import { ZodError } from 'zod';
import { ApiError } from './errors';
import { errorResponse } from './response';

/**
 * Wraps a route handler so every failure path produces the same JSON shape.
 *
 *   export const GET = withRoute(async (request, ctx) => ok(...));
 *
 * Keeps handlers free of try/catch and guarantees that unexpected errors are
 * logged server-side but reported to the client as a bare 500.
 */
export function withRoute(handler) {
  return async function routeHandler(request, ctx) {
    try {
      return await handler(request, ctx);
    } catch (error) {
      if (error instanceof ApiError) {
        return errorResponse({
          status: error.status,
          code: error.code,
          message: error.message,
          details: error.details,
        });
      }

      if (error instanceof ZodError) {
        return errorResponse({
          status: 400,
          code: 'validation_failed',
          message: 'Some fields are invalid.',
          details: flattenZodError(error),
        });
      }

      // Unexpected: log the real thing, tell the client nothing.
      console.error('[api] unhandled error:', error);
      return errorResponse({
        status: 500,
        code: 'internal_error',
        message: 'Something went wrong. Please try again.',
      });
    }
  };
}

function flattenZodError(error) {
  const fields = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}
