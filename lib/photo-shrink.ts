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

type Step = readonly [maxSide: number, quality: number];

/** Re-encode at each (size, quality) step until the result fits under maxBytes. */
async function shrink(file: File, steps: readonly Step[], maxBytes: number, noun: string): Promise<Blob> {
  if (file.type && !file.type.startsWith("image/")) throw new Error(`${file.name} isn't ${noun}.`);
  let bitmap: ImageBitmap;
  try {
    // Respect the camera's rotation flag before it's dropped with the metadata.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`Couldn't open ${file.name || "that image"}. Try a PNG or JPEG.`);
  }
  try {
    for (const [max, quality] of steps) {
      const blob = await encode(bitmap, max, quality);
      if (blob.size <= maxBytes) return blob;
    }
    throw new Error(`${file.name || "That image"} is too large even after shrinking.`);
  } finally {
    bitmap.close();
  }
}

export async function shrinkPhoto(file: File): Promise<Blob> {
  return shrink(file, [[PHOTO_MAX_SIDE, 0.82], [1280, 0.72], [1024, 0.65]], PHOTO_MAX_BYTES, "a photo");
}

/**
 * Screenshots for autofill: a larger long side than tour photos so small print
 * on a tall phone screenshot stays readable, and a higher JPEG quality because
 * text blurs sooner than a photo does. Never uploaded for storage.
 */
export const SCREENSHOT_STEPS: readonly Step[] = [[2048, 0.85], [1600, 0.8], [1280, 0.75]];

export async function shrinkScreenshot(file: File, maxBytes: number): Promise<Blob> {
  return shrink(file, SCREENSHOT_STEPS, maxBytes, "an image");
}
