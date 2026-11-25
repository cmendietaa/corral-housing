import { NextResponse, type NextRequest } from "next/server";
import { checkUrl, fetchPage, FetchRefused } from "@/lib/link-import/fetch-page";
import { robotsSay } from "@/lib/link-import/robots-check";

/**
 * GET /api/listing-photo?url=…  ->  the image, or { error }
 *
 * Downloads one listing photo the person chose to keep, so it can be saved
 * with the group's photos. Same rules as reading a link: never from sites
 * whose terms forbid it, robots.txt respected, no private addresses, and
 * nothing kept here; the browser shrinks it and saves it like any photo.
 */

export const runtime = "nodejs";

const PER_HOUR = 60;
const hits = new Map<string, { count: number; resetAt: number }>();
function limited(ip: string): boolean {
  const now = Date.now();
  if (hits.size > 1000) for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
  const e = hits.get(ip);
  if (!e || e.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return false;
  }
  e.count += 1;
  return e.count > PER_HOUR;
}

const IMAGE = /^image\/(jpeg|png|webp|avif|gif)\b/i;
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url") ?? "";
  let url: URL;
  try {
    url = checkUrl(raw);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "That photo can't be fetched.", 400);
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limited(ip)) return fail("That's a lot of photos this hour. Try again later.", 429);
  if ((await robotsSay(url)) !== "allow") return fail("That site asks apps not to fetch this photo.", 403);

  try {
    const res = await fetchPage(url, { timeoutMs: 10_000, maxBytes: 10_000_000, accept: "image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8" });
    if (res.status !== 200 || !IMAGE.test(res.contentType)) return fail("That isn't a photo Corral can keep.", 415);
    return new NextResponse(new Uint8Array(res.bytes), { headers: { "Content-Type": res.contentType.split(";")[0]!, "Cache-Control": "private, no-store" } });
  } catch (e) {
    return fail(e instanceof FetchRefused ? e.message : "Couldn't fetch that photo.", 502);
  }
}
