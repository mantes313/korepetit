import { withRoute } from '@/server/handler';
import { ok } from '@/server/response';
import { requireUser } from '@/server/session';
import { parseBody, parseParams, uuid, z } from '@/server/validate';
import { badRequest } from '@/server/errors';
import {
  getLesson,
  updateLessonStatus,
  markLessonPaid,
} from '@/server/services/lessons';

export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ id: uuid });

/**
 * Every mutation is a named action rather than a column patch. The old
 * client sent `{ status }` / `{ paid_at }` straight into an `update()`, and
 * the RLS policy behind it allowed any column through.
 */
const patchSchema = z.union([
  z.object({ action: z.literal('accept') }),
  z.object({ action: z.literal('reject') }),
  z.object({ action: z.literal('cancel') }),
  z.object({ action: z.literal('markPaid') }),
]);

export const GET = withRoute(async (_request, ctx) => {
  const session = await requireUser();
  const { id } = await parseParams(ctx, paramsSchema);
  return ok(await getLesson(session, id));
});

export const PATCH = withRoute(async (request, ctx) => {
  const session = await requireUser();
  const { id } = await parseParams(ctx, paramsSchema);
  const { action } = await parseBody(request, patchSchema);

  switch (action) {
    case 'accept':
      return ok(await updateLessonStatus(session, id, 'accepted'));
    case 'reject':
    case 'cancel':
      return ok(await updateLessonStatus(session, id, 'rejected'));
    case 'markPaid':
      return ok(await markLessonPaid(session, id));
    default:
      throw badRequest('Unknown action.');
  }
});
