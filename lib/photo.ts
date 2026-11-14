// Photo pipeline: file -> JPEG <= 1600 px (strips EXIF incl. GPS) -> signed upload -> photoPath.
// Photos never go through /api (Vercel body limit 4.5 MB).
import { api } from './api';
import { getBrowserSupabase } from './supabase/browser';

export const PHOTO_BUCKET = 'stage-photos';
export const MAX_INPUT_BYTES = 25 * 1024 * 1024;

export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  if (width <= maxSide && height <= maxSide) return { width, height };
  const scale = maxSide / Math.max(width, height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Decodes via <img> (applies EXIF orientation, decodes HEIC on Safari) and re-encodes to JPEG. */
export async function compressImage(file: Blob, maxSide = 1600, quality = 0.8): Promise<Blob> {
  if (file.size > MAX_INPUT_BYTES) throw new Error('This photo is too large. Pick one under 25 MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, maxSide);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser cannot process photos.');
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process this photo.'))), 'image/jpeg', quality),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Returns the photoPath to pass to api.completeStage(). Throws Error with a user-facing message. */
export async function uploadStagePhoto(stageId: string, file: Blob): Promise<string> {
  const blob = await compressImage(file);
  const { photoPath, token } = await api.stageUploadUrl(stageId);
  const { error } = await getBrowserSupabase()
    .storage.from(PHOTO_BUCKET)
    .uploadToSignedUrl(photoPath, token, blob, { contentType: 'image/jpeg' });
  if (error) throw new Error('Upload failed. Check your connection and try again.');
  return photoPath;
}
