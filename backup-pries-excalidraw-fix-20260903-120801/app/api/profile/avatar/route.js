import { withRoute } from '@/server/handler';
import { ok } from '@/server/response';
import { requireUser } from '@/server/session';
import { badRequest } from '@/server/errors';
import { uploadAvatar } from '@/server/services/storage';

export const dynamic = 'force-dynamic';

/**
 * Multipart upload. Size, declared MIME type and magic bytes are all checked
 * server-side before anything reaches the public avatars bucket.
 */
export const POST = withRoute(async (request) => {
  const ctx = await requireUser();

  let form;
  try {
    form = await request.formData();
  } catch {
    throw badRequest('Expected a multipart form upload.');
  }

  const file = form.get('file');
  return ok(await uploadAvatar(ctx, file));
});
