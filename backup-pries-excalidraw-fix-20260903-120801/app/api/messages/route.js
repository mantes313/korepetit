import { withRoute } from '@/server/handler';
import { created, ok } from '@/server/response';
import { requireUser } from '@/server/session';
import { parseBody, uuid, z } from '@/server/validate';
import { listConversations, sendMessage } from '@/server/services/messages';

export const dynamic = 'force-dynamic';

const sendSchema = z.object({
  receiverId: uuid,
  body: z.string().trim().min(1, 'Message cannot be empty.').max(2000),
});

export const GET = withRoute(async () => {
  const ctx = await requireUser();
  return ok(await listConversations(ctx));
});

export const POST = withRoute(async (request) => {
  const ctx = await requireUser();
  const input = await parseBody(request, sendSchema);
  return created(await sendMessage(ctx, input));
});
