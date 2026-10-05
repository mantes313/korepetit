import { badRequest, fromSupabaseError, payloadTooLarge } from '../errors';

const AVATAR_BUCKET = 'avatars';
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Raster images only.
 *
 * SVG is deliberately excluded: the avatars bucket is public, and an SVG
 * served from the storage origin can carry script. The old upload path took
 * whatever the file input produced — the `accept` attribute was the only
 * check and it is trivially bypassed.
 */
const ALLOWED_AVATAR_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

/** Magic bytes, so a renamed file cannot masquerade as an image. */
const SIGNATURES = [
  { type: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { type: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // WEBP: "RIFF" .... "WEBP" — offset 8 checked separately.
  { type: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] },
];

function detectImageType(bytes) {
  for (const { type, bytes: signature } of SIGNATURES) {
    if (signature.every((byte, i) => bytes[i] === byte)) {
      if (type === 'image/webp') {
        const tag = String.fromCharCode(...bytes.slice(8, 12));
        if (tag !== 'WEBP') continue;
      }
      return type;
    }
  }
  return null;
}

export async function uploadAvatar({ supabase, user }, file) {
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw badRequest('No file was uploaded.');
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw payloadTooLarge('Image must be 2 MB or smaller.');
  }
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    throw badRequest('Image must be a JPEG, PNG, or WebP file.');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectImageType(buffer);
  if (!detected || detected !== file.type) {
    throw badRequest('File contents do not match a JPEG, PNG, or WebP image.');
  }

  // Fixed path per user — the storage policy pins writes to `<uid>/…`, and a
  // stable name means the public URL never accumulates orphans.
  const extension = ALLOWED_AVATAR_TYPES.get(detected);
  const path = `${user.id}/avatar.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, buffer, {
      upsert: true,
      contentType: detected,
      cacheControl: '3600',
    });

  if (uploadError) throw fromSupabaseError(uploadError, 'Could not upload the image.');

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  // Cache-bust so the UI shows the new image immediately.
  const publicUrl = `${data.publicUrl}?v=${Date.now()}`;

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ photo_url: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (profileError) {
    throw fromSupabaseError(profileError, 'Image uploaded but the profile did not update.');
  }

  return { photoUrl: publicUrl };
}

export { MAX_AVATAR_BYTES, ALLOWED_AVATAR_TYPES };
