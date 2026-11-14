import 'server-only';
import { AppError } from './errors';
import { adminClient } from './supabase';

export const PHOTO_BUCKET = 'stage-photos';

/** Path is always <userId>/<stageId>/<uuid>.jpg — complete_stage checks the prefix. */
export async function createPhotoUpload(userId: string, stageId: string) {
  const path = `${userId}/${stageId}/${crypto.randomUUID()}.jpg`;
  const { data, error } = await adminClient().storage.from(PHOTO_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new AppError('INTERNAL', undefined, { details: error?.message });
  return { photoPath: data.path, token: data.token, signedUrl: data.signedUrl };
}

export async function photoExists(path: string): Promise<boolean> {
  const cut = path.lastIndexOf('/');
  const { data, error } = await adminClient()
    .storage.from(PHOTO_BUCKET)
    .list(path.slice(0, cut), { search: path.slice(cut + 1), limit: 1 });
  return !error && !!data?.some((f) => f.name === path.slice(cut + 1));
}

/** One request for many photos. Returns path -> signed URL (1h). */
export async function signPhotos(paths: string[], expiresIn = 3600): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  const out = new Map<string, string>();
  if (unique.length === 0) return out;
  const { data, error } = await adminClient().storage.from(PHOTO_BUCKET).createSignedUrls(unique, expiresIn);
  if (error || !data) throw new AppError('INTERNAL', undefined, { details: error?.message });
  for (const item of data) if (item.path && item.signedUrl) out.set(item.path, item.signedUrl);
  return out;
}
