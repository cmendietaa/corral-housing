/**
 * Screenshot limits and file-type checks, shared by the browser (before upload)
 * and the server (which never trusts the browser's word for it).
 */

export const MAX_SCREENSHOTS = 3;
/** Per screenshot, after the browser shrinks it (a phone screenshot ends up around 300 KB). */
export const MAX_SCREENSHOT_BYTES = 1.5 * 1024 * 1024;

export type ImageType = "image/jpeg" | "image/png" | "image/webp";

/** The real type from the file's first bytes, or null. Ignores the name and Content-Type. */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  const b = (i: number) => bytes[i];
  if (bytes.length >= 3 && b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b(i) === v)
  ) {
    return "image/png";
  }
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}
