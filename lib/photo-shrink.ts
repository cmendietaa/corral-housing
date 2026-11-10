/**
 * Shrinks a photo in the browser before upload: longest side 1600px, JPEG.
 * Re-drawing onto a canvas also drops the file's metadata (EXIF), including
 * the GPS location and phone model a camera photo carries.
 */

export const PHOTO_MAX_SIDE = 1600;
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

/** Scales (w, h) to fit inside max x max, never upscaling. */
export function fitWithin(w: number, h: number, max = PHOTO_MAX_SIDE): { width: number; height: number } {
  if (w <= 0 || h <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

async function encode(bitmap: ImageBitmap, max: number, quality: number): Promise<Blob> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't prepare photos.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("This browser can't prepare photos.");
  return blob;
}

export async function shrinkPhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} isn't a photo.`);
  let bitmap: ImageBitmap;
  try {
    // Respect the camera's rotation flag before it's dropped with the metadata.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`Couldn't read ${file.name}. Try a JPEG or PNG.`);
  }
  try {
    for (const [max, quality] of [[PHOTO_MAX_SIDE, 0.82], [1280, 0.72], [1024, 0.65]] as const) {
      const blob = await encode(bitmap, max, quality);
      if (blob.size <= PHOTO_MAX_BYTES) return blob;
    }
    throw new Error(`${file.name} is too large even after shrinking.`);
  } finally {
    bitmap.close();
  }
}
