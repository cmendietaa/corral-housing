import { NextResponse, type NextRequest } from "next/server";
import { roundCoord, streetViewQuery } from "@/lib/streetview";

/**
 * GET /api/streetview/date?lat=..&lng=..  ->  { date: "2019-04" } or { date: null }
 * When the nearest Street View photo was taken, so old imagery is labeled as
 * old. Google's metadata endpoint is free; nothing is stored on our side.
 */
export async function GET(request: NextRequest) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const parsed = streetViewQuery.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!key || !parsed.success) return NextResponse.json({ date: null }, { headers: { "Cache-Control": "no-store" } });

  const location = `${roundCoord(parsed.data.lat)},${roundCoord(parsed.data.lng)}`;
  try {
    const meta = (await fetch(
      `https://maps.googleapis.com/maps/api/streetview/metadata?location=${location}&source=outdoor&radius=60&key=${key}`,
      { cache: "no-store" }
    ).then((r) => r.json())) as { status: string; date?: string };
    const date = meta.status === "OK" && /^\d{4}(-\d{2})?$/.test(meta.date ?? "") ? meta.date! : null;
    return NextResponse.json({ date }, { headers: { "Cache-Control": "private, max-age=86400" } });
  } catch {
    return NextResponse.json({ date: null }, { headers: { "Cache-Control": "no-store" } });
  }
}
