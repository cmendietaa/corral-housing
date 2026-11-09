/**
 * Which pins the map should open on. A board is usually one neighborhood plus
 * a stray or two (a Goleta house, a mis-dropped pin). Fitting all of them
 * shrinks the neighborhood to a smudge, so open on the main cluster: pins
 * within `radiusKm` of the median point. Location-agnostic.
 */

export type LatLng = { lat: number; lng: number };

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Great-circle distance in kilometers. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function mainCluster<T extends LatLng>(points: T[], radiusKm = 1.5): { cluster: T[]; outside: T[] } {
  if (points.length <= 2) return { cluster: points, outside: [] };
  const center = { lat: median(points.map((p) => p.lat)), lng: median(points.map((p) => p.lng)) };
  const cluster = points.filter((p) => distanceKm(center, p) <= radiusKm);
  // Never open on nothing: if the points are evenly spread, show them all.
  if (cluster.length === 0) return { cluster: points, outside: [] };
  return { cluster, outside: points.filter((p) => !cluster.includes(p)) };
}
