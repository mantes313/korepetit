import { withRoute } from '@/server/handler';
import { ok } from '@/server/response';
import { requireUser } from '@/server/session';
import { listTeachers } from '@/server/services/profiles';

export const dynamic = 'force-dynamic';

export const GET = withRoute(async () => {
  const ctx = await requireUser();
  return ok(await listTeachers(ctx));
});
