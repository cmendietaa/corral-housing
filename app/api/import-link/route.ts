import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { extractFacts } from "@/lib/link-import/extract";
import { checkUrl, fetchPage, FetchRefused } from "@/lib/link-import/fetch-page";
import { readPage } from "@/lib/link-import/read-page";
import { robotsAllowRedirect, robotsSay } from "@/lib/link-import/robots-check";
import { skippedSite } from "@/lib/link-import/sites";

/**
 * POST /api/import-link { url }
 *   -> { fields, source: "ai" | "parser", note? }   facts to fill in, for the person to check
 *   -> { fallback: "skipped" | "blocked", message } this site can't be read; paste or screenshot instead
 *   -> { error }                                     a bad link or a page that couldn't be read
 *
 * Reads the one page a person pasted, once, when they ask. Sites whose terms
 * forbid apps reading their listings are never fetched (lib/link-import/sites.ts),
 * robots.txt is respected, and a bot check or a refusal is taken as a no. Only
 * facts come back (rent, beds, address...); the page, its photos and its
 * description are not stored.
 */

export const runtime = "nodejs";

const LINKS_PER_HOUR = 30;
const hits = new Map<string, { count: number; resetAt: number }>();

function limited(ip: string): boolean {
  const now = Date.now();
  if (hits.size > 1000) for (const [key, value] of hits) if (value.resetAt < now) hits.delete(key);
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return false;
  }
  entry.count += 1;
  return entry.count > LINKS_PER_HOUR;
}

const fallback = (kind: "skipped" | "blocked", message: string) => NextResponse.json({ fallback: kind, message });
const error = (message: string, status: number) => NextResponse.json({ error: message }, { status });

const PASTE_INSTEAD = "Paste the listing's text or add a screenshot instead.";

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return error("Send the link as JSON.", 400);
  }
  const body = z.object({ url: z.string().max(2000) }).safeParse(raw);
  if (!body.success) return error("Paste the listing's link.", 400);

  let url: URL;
  try {
    url = checkUrl(body.data.url);
  } catch (e) {
    if (e instanceof FetchRefused && e.reason === "skipped") return fallback("skipped", `${e.message} ${PASTE_INSTEAD}`);
    return error(e instanceof Error ? e.message : "That link can't be read.", 400);
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limited(ip)) return error("You've read a lot of links this hour. Paste the listing's text instead.", 429);

  const host = url.hostname.replace(/^www\./, "");
  const robots = await robotsSay(url);
  if (robots === "private") return error("Only links to public websites can be read.", 400);
  if (robots === "skipped") return fallback("skipped", `That link leads to a site that doesn't allow apps to read its listings. ${PASTE_INSTEAD}`);
  if (robots === "unreachable") return error(`Couldn't reach ${host} right now. ${PASTE_INSTEAD}`, 502);
  if (robots === "disallow") {
    return fallback("blocked", `${host} asks apps not to read this page. ${PASTE_INSTEAD}`);
  }

  let page;
  try {
    page = await fetchPage(url, { beforeRedirect: robotsAllowRedirect });
  } catch (e) {
    if (e instanceof FetchRefused && e.reason === "skipped") return fallback("skipped", `${e.message} ${PASTE_INSTEAD}`);
    if (e instanceof FetchRefused && e.reason === "robots") return fallback("blocked", `${e.message} ${PASTE_INSTEAD}`);
    if (e instanceof FetchRefused && e.reason === "private") return error(e.message, 400);
    return error(`${e instanceof Error ? e.message : "Couldn't open that page."} ${PASTE_INSTEAD}`, 502);
  }

  if ([401, 403, 407, 429, 451, 503].includes(page.status)) {
    return fallback("blocked", `${host} didn't let Corral read the page. ${PASTE_INSTEAD}`);
  }
  if (page.status === 404 || page.status === 410) return error("That page wasn't found. Check the link.", 404);
  if (page.status < 200 || page.status >= 300) return error(`Couldn't open that page. ${PASTE_INSTEAD}`, 502);
  if (!/text\/html|application\/xhtml/i.test(page.contentType)) return error(`That link isn't a web page. ${PASTE_INSTEAD}`, 415);

  const read = readPage(page.body, page.url.toString());
  if (read.challenge) return fallback("blocked", `${host} asked for a robot check, so Corral didn't read it. ${PASTE_INSTEAD}`);

  const { fields, source, note } = await extractFacts(read, body.data.url.trim(), ip);
  // The listing's photos, offered (not copied): the person picks any to keep on the check screen.
  const photos = read.images.filter((src) => !skippedSite(new URL(src).hostname));
  return NextResponse.json({ fields, source, site: host, photos, ...(note ? { note } : {}) });
}
