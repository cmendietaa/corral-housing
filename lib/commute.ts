/**
 * Rough commute to UCSB from a pin, with no outside service: straight-line
 * distance to the edge of main campus, times a detour factor for IV's grid,
 * at typical walking and biking speeds. Labeled "about" everywhere it shows.
 */

/** Pardall Rd bike path entrance, where most IV trips enter campus. */
export const CAMPUS = { lat: 34.4128, lng: -119.8555 } as const;

const DETOUR = 1.3;
const WALK_M_PER_MIN = 80; // ~4.8 km/h
const BIKE_M_PER_MIN = 250; // ~15 km/h

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type Commute = { walkMin: number; bikeMin: number };

export function commuteToCampus(lat: number | null, lng: number | null): Commute | null {
  if (lat === null || lng === null) return null;
  const m = distanceMeters({ lat, lng }, CAMPUS) * DETOUR;
  return { walkMin: Math.max(1, Math.round(m / WALK_M_PER_MIN)), bikeMin: Math.max(1, Math.round(m / BIKE_M_PER_MIN)) };
}

/** "6 min bike · 18 min walk", or null when there's no pin. */
export function formatCommute(c: Commute | null): string | null {
  return c ? `${c.bikeMin} min bike · ${c.walkMin} min walk` : null;
}
