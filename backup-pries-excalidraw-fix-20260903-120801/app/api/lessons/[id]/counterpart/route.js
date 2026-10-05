import { withRoute } from '@/server/handler';
import { ok } from '@/server/response';
import { requireUser } from '@/server/session';
import { parseParams, uuid, z } from '@/server/validate';
import { getLesson } from '@/server/services/lessons';
import { getCounterpartDetails } from '@/server/services/profiles';

export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ id: uuid });

/**
 * Contact details for the other party on one lesson.
 *
 * This is the only path that releases phone, email or IBAN, and it does so
 * per lesson after confirming the caller is on it. Lists never carry them.
 */
export const GET = withRoute(async (_request, ctx) => {
  const session = await requireUser();
  const { id } = await parseParams(ctx, paramsSchema);
  const lesson = await getLesson(session, id);
  return ok(await getCounterpartDetails(session, lesson));
});
