import { z } from "zod";

/**
 * Street View previews. The browser asks our own route for a photo by
 * coordinates; the route holds the Google key, so it never reaches the client.
 *
 * To keep the key from being used as a free Street View proxy, requests are
 * limited to the area Corral serves (Isla Vista, Goleta and nearby Santa
 * Barbara) and to a few fixed image sizes.
 */

export const SERVICE_AREA = { south: 34.38, north: 34.47, west: -119.95, east: -119.75 } as const;
/**
 * The only image sizes the proxy will request, roughly 2x what each frame
 * displays (Street View Static caps at 640px a side). CSS crops to the frame.
 */
export const PHOTO_SIZES = {
  row: "104x152",
  card: "640x330",
  compare: "640x320",
  kanban: "560x220",
  sheet: "640x614"
} as const;
export type PhotoSize = keyof typeof PHOTO_SIZES;

export const streetViewQuery = z.object({
  lat: z.coerce.number().min(SERVICE_AREA.south).max(SERVICE_AREA.north),
  lng: z.coerce.number().min(SERVICE_AREA.west).max(SERVICE_AREA.east),
  s: z.enum(Object.keys(PHOTO_SIZES) as [PhotoSize, ...PhotoSize[]]).default("card")
});

/** Round to ~1 m so near-identical requests look the same to caches. */
export function roundCoord(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

/** Compass bearing in degrees (0 = north) from `from` to `to`, so the camera faces the place. */
export function bearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(from.lat);
  const φ2 = toRad(to.lat);
  const Δλ = toRad(to.lng - from.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.round((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

/** The client-side URL for a place's photo, or null when the place has no pin. */
export function streetViewSrc(lat: number | null, lng: number | null, size: PhotoSize = "card"): string | null {
  if (lat === null || lng === null) return null;
  return `/api/streetview?lat=${roundCoord(lat)}&lng=${roundCoord(lng)}&s=${size}`;
}
