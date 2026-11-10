import { SERVICE_AREA } from "@/lib/streetview";

/**
 * Address -> map pin, with free services only:
 *   1. US Census Geocoder (no key, government service)
 *   2. OpenStreetMap Nominatim as the fallback (1 request/second, identified client)
 * Results outside Isla Vista / Goleta are rejected, so a vague address
 * ("6545 Trigo") can't drop a pin in another state.
 */

export type Pin = { lat: number; lng: number };
type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const AREA_WORDS = /\b(isla vista|goleta|santa barbara|ca|california)\b/i;

/** Adds the area to bare street addresses: "6545 Trigo Rd" -> "6545 Trigo Rd, Isla Vista, CA". */
export function addressQuery(address: string): string | null {
  const a = address.trim().replace(/\s+/g, " ");
  if (!/\d/.test(a) || a.length < 6 || a.length > 200) return null; // needs a street number
  return AREA_WORDS.test(a) ? (/\b(ca|california)\b/i.test(a) ? a : `${a}, CA`) : `${a}, Isla Vista, CA`;
}

export function inServiceArea(p: Pin): boolean {
  return p.lat >= SERVICE_AREA.south && p.lat <= SERVICE_AREA.north && p.lng >= SERVICE_AREA.west && p.lng <= SERVICE_AREA.east;
}

function round(p: Pin): Pin {
  return { lat: Math.round(p.lat * 1e6) / 1e6, lng: Math.round(p.lng * 1e6) / 1e6 };
}

async function census(q: string, f: Fetch): Promise<Pin | null> {
  const url =
    "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json&address=" +
    encodeURIComponent(q);
  const res = await f(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  const data = (await res.json()) as { result?: { addressMatches?: { coordinates: { x: number; y: number } }[] } };
  const c = data.result?.addressMatches?.[0]?.coordinates;
  return c ? { lat: c.y, lng: c.x } : null;
}

async function nominatim(q: string, f: Fetch): Promise<Pin | null> {
  const { south, north, west, east } = SERVICE_AREA;
  const url =
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&bounded=1` +
    `&viewbox=${west},${north},${east},${south}&q=${encodeURIComponent(q)}`;
  const res = await f(url, {
    headers: { "User-Agent": "Corral housing board (github.com/cmendietaa/corral-housing)" },
    signal: AbortSignal.timeout(5000)
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { lat: string; lon: string }[];
  return data[0] ? { lat: Number(data[0].lat), lng: Number(data[0].lon) } : null;
}

export async function geocodeAddress(address: string, f: Fetch = fetch): Promise<Pin | null> {
  const q = addressQuery(address);
  if (!q) return null;
  for (const source of [census, nominatim]) {
    try {
      const pin = await source(q, f);
      if (pin && Number.isFinite(pin.lat) && Number.isFinite(pin.lng) && inServiceArea(pin)) return round(pin);
    } catch {
      // Timeout or bad response: try the next source.
    }
  }
  return null;
}
