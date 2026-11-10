import type { Pin } from "@/lib/geocode";

/** Browser side: ask Corral's /api/geocode for a pin. Never throws; null means "drop it by hand". */
export async function lookupPin(address: string | null): Promise<Pin | null> {
  if (!address || !/\d/.test(address)) return null;
  try {
    const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
    if (!res.ok) return null;
    const pin = (await res.json()) as Pin;
    return Number.isFinite(pin.lat) && Number.isFinite(pin.lng) ? pin : null;
  } catch {
    return null;
  }
}
