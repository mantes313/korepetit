import { withRoute } from '@/server/handler';
import { ok } from '@/server/response';
import { requireUser } from '@/server/session';
import { parseParams, uuid, z } from '@/server/validate';
import { getRoomAccess } from '@/server/services/lessons';

export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ id: uuid });

/**
 * Authoritative join gate for /lessons/<id>/call. The room page asks this
 * before mounting the WebRTC and whiteboard components.
 */
export const GET = withRoute(async (_request, ctx) => {
  const session = await requireUser();
  const { id } = await parseParams(ctx, paramsSchema);
  return ok(await getRoomAccess(session, id));
});
