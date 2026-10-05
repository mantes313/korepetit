import { withRoute } from '@/server/handler';
import { ok } from '@/server/response';
import { requireUser } from '@/server/session';
import { parseParams, uuid, z } from '@/server/validate';
import { listThread, markThreadRead } from '@/server/services/messages';

export const dynamic = 'force-dynamic';

/**
 * `partnerId` is validated as a UUID before it reaches any query. The old
 * client read this straight from `?with=` and interpolated it into a
 * PostgREST `.or()` filter string.
 */
const paramsSchema = z.object({ partnerId: uuid });

export const GET = withRoute(async (_request, ctx) => {
  const session = await requireUser();
  const { partnerId } = await parseParams(ctx, paramsSchema);
  return ok(await listThread(session, partnerId));
});

export const PATCH = withRoute(async (_request, ctx) => {
  const session = await requireUser();
  const { partnerId } = await parseParams(ctx, paramsSchema);
  return ok(await markThreadRead(session, partnerId));
});
