import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { geocodeAddress } from "@/lib/geocode";

/**
 * GET /api/geocode?address=...  ->  { lat, lng } or 404
 * Places a map pin from an address using free geocoders (see lib/geocode.ts).
 * Rate-limited per IP; results are cached by the CDN since addresses don't move.
 */

const query = z.object({ address: z.string().trim().min(6).max(200) });

const WINDOW_MS = 60 * 60 * 1000;
const PER_WINDOW = 60;
const hits = new Map<string, { count: number; resetAt: number }>();

function allow(ip: string): boolean {
  const now = Date.now();
  if (hits.size > 1000) for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
  const e = hits.get(ip);
  if (!e || e.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (e.count >= PER_WINDOW) return false;
  e.count += 1;
  return true;
}

export async function GET(request: NextRequest) {
  const parsed = query.safeParse({ address: request.nextUrl.searchParams.get("address") ?? "" });
  if (!parsed.success) return NextResponse.json({ error: "Enter a street address." }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allow(ip)) return NextResponse.json({ error: "Too many lookups. Drop the pin by hand for now." }, { status: 429 });

  const pin = await geocodeAddress(parsed.data.address);
  if (!pin) {
    return NextResponse.json(
      { error: "Couldn't find that address around Isla Vista or Goleta." },
      { status: 404, headers: { "Cache-Control": "public, s-maxage=3600" } }
    );
  }
  return NextResponse.json(pin, { headers: { "Cache-Control": "public, s-maxage=2592000" } });
}
