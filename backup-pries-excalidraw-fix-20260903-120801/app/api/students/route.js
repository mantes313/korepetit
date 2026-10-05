import { withRoute } from '@/server/handler';
import { ok } from '@/server/response';
import { requireRole } from '@/server/session';
import { listSchedulableStudents } from '@/server/services/profiles';

export const dynamic = 'force-dynamic';

/** Teacher-only, and returns discovery fields only (no emails, no grades). */
export const GET = withRoute(async () => {
  const ctx = await requireRole('teacher');
  return ok(await listSchedulableStudents(ctx));
});
