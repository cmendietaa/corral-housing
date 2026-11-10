import { NextResponse, type NextRequest } from "next/server";
import { bearing, PHOTO_SIZES, roundCoord, streetViewQuery } from "@/lib/streetview";

/**
 * GET /api/streetview?lat=..&lng=..&s=row|card|compare|kanban|sheet
 *
 * Returns a Street View photo of the spot, facing it, or 404 when there's no
 * key, no imagery nearby, or the spot is outside Corral's service area. The
 * UI treats any non-image response as "no street photo".
 *
 * Google's metadata endpoint is free and is checked first, so we only request
 * (and pay for) an image when one exists. Responses are cached in the viewer's
 * browser only; nothing is stored on our side.
 */

const GOOGLE = "https://maps.googleapis.com/maps/api/streetview";

// Best-effort per-IP limit. Serverless instances don't share memory, so this
// slows abuse rather than stopping it; the key's own quota is the real cap.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 200;
const hits = new Map<string, { count: number; resetAt: number }>();

function limited(ip: string): boolean {
  const now = Date.now();
  // Forget expired entries now and then so the map can't grow without bound.
  if (hits.size > 1000) for (const [key, value] of hits) if (value.resetAt < now) hits.delete(key);
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

function notFound(reason: string, cache = "no-store") {
  return NextResponse.json({ error: reason }, { status: 404, headers: { "Cache-Control": cache } });
}

export async function GET(request: NextRequest) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return notFound("Street View isn't set up on this deployment.");

  const parsed = streetViewQuery.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return notFound("Street View is only available around Isla Vista and Goleta.");

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limited(ip)) {
    return NextResponse.json({ error: "Too many photo requests. Try again later." }, { status: 429 });
  }

  const target = { lat: roundCoord(parsed.data.lat), lng: roundCoord(parsed.data.lng) };
  const location = `${target.lat},${target.lng}`;

  try {
    const metaUrl = `${GOOGLE}/metadata?location=${location}&source=outdoor&radius=60&key=${key}`;
    const meta = (await fetch(metaUrl, { cache: "no-store" }).then((r) => r.json())) as {
      status: string;
      pano_id?: string;
      location?: { lat: number; lng: number };
    };
    if (meta.status !== "OK" || !meta.pano_id || !meta.location) {
      // No imagery here is a stable answer; let the browser remember it for a day.
      return notFound("No Street View imagery near this spot.", "private, max-age=86400");
    }

    const heading = bearing(meta.location, target);
    const imageUrl =
      `${GOOGLE}?size=${PHOTO_SIZES[parsed.data.s]}&pano=${meta.pano_id}&heading=${heading}` +
      `&fov=80&pitch=5&return_error_code=true&key=${key}`;
    const image = await fetch(imageUrl, { cache: "no-store" });
    if (!image.ok || !image.headers.get("content-type")?.startsWith("image/")) {
      return notFound("Street View didn't return a photo.");
    }

    return new NextResponse(image.body, {
      status: 200,
      headers: {
        "Content-Type": image.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "private, max-age=86400"
      }
    });
  } catch {
    return notFound("Street View is unavailable right now.");
  }
}
