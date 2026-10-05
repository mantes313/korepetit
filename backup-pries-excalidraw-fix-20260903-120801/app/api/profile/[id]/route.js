import { withRoute } from '@/server/handler';
import { ok } from '@/server/response';
import { requireUser } from '@/server/session';
import { parseParams, uuid, z } from '@/server/validate';
import { getPublicProfile } from '@/server/services/profiles';

export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ id: uuid });

/** Public card only — contact details live behind the per-lesson endpoint. */
export const GET = withRoute(async (_request, ctx) => {
  const session = await requireUser();
  const { id } = await parseParams(ctx, paramsSchema);
  return ok(await getPublicProfile(session, id));
});
