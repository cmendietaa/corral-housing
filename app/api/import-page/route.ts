import { NextResponse, type NextRequest } from "next/server";
import { extractFacts } from "@/lib/link-import/extract";
import { readSentPage } from "@/lib/link-import/read-page";
import { skippedSite } from "@/lib/link-import/sites";
import { sentPageSchema } from "@/lib/send/payload";

/**
 * POST /api/import-page { url, title, text, ld }
 *   -> { fields, source, site, note? }   facts to fill in, for the person to check
 *   -> { error }
 *
 * Send to Corral: the person's own browser read the listing they were looking
 * at (rent and all, even on sites that load it with JavaScript) and sent the
 * text here. Corral never contacts the listing site, so this works on any
 * site, the same as pasting the text. Nothing is stored; only the facts come
 * back for review.
 */

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Send the page as JSON." }, { status: 400 });
  }
  const sent = sentPageSchema.safeParse(raw);
  if (!sent.success) return NextResponse.json({ error: "That page couldn't be read. Paste the listing's text instead." }, { status: 400 });

  const read = readSentPage(sent.data);
  if (read.text.trim().length < 10) {
    return NextResponse.json({ error: "That page didn't have any text Corral could read. Paste the listing or add a screenshot." }, { status: 422 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const site = new URL(sent.data.url).hostname.replace(/^www\./, "");
  const { fields, source, note } = await extractFacts(read, sent.data.url, ip);
  // Photos are offered for the person to pick, never copied by default, and
  // never from sites whose terms forbid apps using their listings.
  const photos = skippedSite(site) ? [] : read.images.filter((src) => !skippedSite(new URL(src).hostname));
  return NextResponse.json({ fields, source, site, photos, ...(note ? { note } : {}) });
}
