import { withRoute } from '@/server/handler';
import { ok } from '@/server/response';
import { requireUser } from '@/server/session';
import { parseBody, z } from '@/server/validate';
import { getOwnProfile, updateOwnProfile } from '@/server/services/profiles';

export const dynamic = 'force-dynamic';

const subjectSchema = z.object({
  name: z.string().max(120).default(''),
  grades: z.string().max(120).default(''),
});

/**
 * `role` is intentionally absent from this schema. A user may edit every
 * other field on their own profile, but not promote themselves to teacher.
 */
const updateProfileSchema = z
  .object({
    name: z.string().trim().max(120).nullable(),
    phone: z.string().trim().min(5).max(40),
    headline: z.string().trim().max(200).nullable(),
    price_60: z.number().min(0).max(1000).nullable(),
    price_intro: z.boolean(),
    subjects: z.array(subjectSchema).max(30),
    tags: z.array(z.string().max(60)).max(30),
    bio: z.string().max(5000).nullable(),
    availability: z.array(z.string().max(20)).max(200),
    bank_iban: z.string().trim().max(42).nullable(),
    grade: z.string().trim().max(60).nullable(),
    learning_struggles: z.string().max(2000).nullable(),
    expectations: z.string().max(2000).nullable(),
  })
  .partial();

export const GET = withRoute(async () => {
  const ctx = await requireUser();
  return ok(await getOwnProfile(ctx));
});

export const PATCH = withRoute(async (request) => {
  const ctx = await requireUser();
  const patch = await parseBody(request, updateProfileSchema);
  return ok(await updateOwnProfile(ctx, patch));
});
