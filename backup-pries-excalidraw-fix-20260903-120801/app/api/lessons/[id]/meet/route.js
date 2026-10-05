import { withRoute } from '@/server/handler';
import { ok } from '@/server/response';
import { requireUser } from '@/server/session';
import { parseBody, parseParams, uuid, z } from '@/server/validate';
import { getLesson, setLessonMeetLink } from '@/server/services/lessons';
import { getCounterpartDetails } from '@/server/services/profiles';
import { createMeetEvent } from '@/server/services/calendar';

export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ id: uuid });

/**
 * The Google access token is sent per call rather than kept in client state
 * for the whole session. It is used here and discarded.
 */
const bodySchema = z.object({
  googleAccessToken: z.string().min(10).max(4096),
});

/**
 * Create a Meet-enabled Calendar event for a lesson and store the link.
 *
 * Calling Google from the server keeps the attendee list under our control —
 * the browser cannot decide who gets invited to the event.
 */
export const POST = withRoute(async (request, ctx) => {
  const session = await requireUser();
  const { id } = await parseParams(ctx, paramsSchema);
  const { googleAccessToken } = await parseBody(request, bodySchema);

  const lesson = await getLesson(session, id);
  const counterpart = await getCounterpartDetails(session, lesson);

  const attendeeEmails = [session.user.email, counterpart?.email].filter(Boolean);

  const { meetLink } = await createMeetEvent({
    token: googleAccessToken,
    lessonId: lesson.id,
    summary: lesson.subject ? `Lesson: ${lesson.subject}` : 'Tutoring lesson',
    description: lesson.notes ?? '',
    date: lesson.date,
    time: lesson.time,
    attendeeEmails,
  });

  if (!meetLink) return ok({ meetLink: null });

  const updated = await setLessonMeetLink(session, lesson.id, meetLink);
  return ok({ meetLink: updated.meet_link });
});
