import { withRoute } from '@/server/handler';
import { created, ok } from '@/server/response';
import { requireProfile } from '@/server/session';
import { parseBody, uuid, isoDate, isoTime, z } from '@/server/validate';
import { forbidden } from '@/server/errors';
import {
  listMyLessons,
  createLessonRequest,
  scheduleLessonAsTeacher,
} from '@/server/services/lessons';

export const dynamic = 'force-dynamic';

const baseFields = {
  date: isoDate,
  time: isoTime,
  subject: z.string().trim().max(120).nullish(),
  notes: z.string().trim().max(2000).nullish(),
};

/**
 * One endpoint, two shapes, discriminated by who the caller is booking.
 * `status` is never accepted from the client — the service sets it.
 */
const createLessonSchema = z.union([
  z.object({ teacherId: uuid, ...baseFields }),
  z.object({ studentId: uuid, ...baseFields }),
]);

export const GET = withRoute(async () => {
  const ctx = await requireProfile();
  return ok(await listMyLessons(ctx));
});

export const POST = withRoute(async (request) => {
  const ctx = await requireProfile();
  const input = await parseBody(request, createLessonSchema);

  if ('teacherId' in input) {
    if (ctx.profile?.role !== 'student') {
      throw forbidden('Only a student can request a lesson from a tutor.');
    }
    return created(await createLessonRequest(ctx, input));
  }

  if (ctx.profile?.role !== 'teacher') {
    throw forbidden('Only a tutor can schedule a lesson with a student.');
  }
  return created(await scheduleLessonAsTeacher(ctx, input));
});
