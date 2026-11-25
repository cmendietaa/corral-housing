import { MAX_PASTE_CHARS } from "@/lib/parse-listing";

/**
 * Pulls what a listing page says about itself, without running any of its code:
 * - structured data (schema.org JSON-LD) and the share preview (Open Graph),
 *   which sites publish on purpose for other apps to read;
 * - the page's visible text, for the same reader that handles pasted text.
 * Photos and descriptions are not kept; they only help fill the form's facts.
 */

export type PageFacts = {
  title: string | null;
  address: string | null;
  rentCents: number | null;
  beds: number | null;
  baths: number | null;
};

export type ReadPage = { facts: PageFacts; text: string; challenge: boolean; images: string[] };

export const MAX_LISTING_PHOTOS = 12;

/** Not listing photos: logos, icons, maps, avatars, tracking pixels. */
const NOT_A_PHOTO = /logo|icon|sprite|avatar|badge|favicon|placeholder|blank|pixel|spacer|map|staticmap|powered-by|\.svg(?:\?|$)|\.gif(?:\?|$)/i;

/** Clean up candidate photo addresses: absolute http(s), no repeats, no obvious non-photos, at most 12. */
export function listingPhotos(candidates: string[], base?: string): string[] {
  const out: string[] = [];
  for (const raw of candidates) {
    let u: URL;
    try {
      u = new URL(decode(raw), base);
    } catch {
      continue;
    }
    if (u.protocol !== "https:" && u.protocol !== "http:") continue;
    if (NOT_A_PHOTO.test(u.pathname)) continue;
    const href = u.toString();
    if (!out.includes(href)) out.push(href);
    if (out.length >= MAX_LISTING_PHOTOS) break;
  }
  return out;
}

function imagesOf(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(imagesOf);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return typeof o.url === "string" ? [o.url] : typeof o.contentUrl === "string" ? [o.contentUrl] : [];
  }
  return [];
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

function decode(s: string): string {
  return s
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function meta(html: string, key: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (name?.toLowerCase() !== key) continue;
    const content = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (content) return decode(content);
  }
  return null;
}

/**
 * Signs that the site answered with a bot check instead of the page: a known
 * bot-wall marker in the markup, or bot-check wording in what a person would
 * read. (A contact form's captcha script on a normal page doesn't count.)
 */
const WALL_MARKUP = /px-captcha|cf-chl-|challenge-platform|_Incapsula_Resource|captcha-delivery\.com|geo\.captcha/i;
const WALL_WORDS = /are you a (?:robot|human)|verify (?:that )?you are (?:a )?human|confirm you are (?:a )?human|press (?:& |and )?hold|access denied|checking your browser|unusual traffic/i;

type Json = Record<string, unknown>;

function jsonLd(html: string): Json[] {
  const out: Json[] = [];
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed: unknown = JSON.parse(m[1]!.trim());
      const walk = (v: unknown) => {
        if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === "object") {
          out.push(v as Json);
          const graph = (v as Json)["@graph"];
          if (graph) walk(graph);
        }
      };
      walk(parsed);
    } catch {
      // Broken structured data: ignore it, the text still gets read.
    }
  }
  return out;
}

const PLACE_TYPES = /apartment|house|residence|accommodation|singlefamily|realestatelisting|product|place|offer|lodging/i;

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^0-9.]/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

function textOf(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? decode(v) : null;
}

function addressOf(v: unknown): string | null {
  if (typeof v === "string") return textOf(v);
  if (v && typeof v === "object") {
    const a = v as Json;
    const street = textOf(a.streetAddress);
    const city = textOf(a.addressLocality);
    return street ? [street, city].filter(Boolean).join(", ") : null;
  }
  return null;
}

function factsFromJsonLd(items: Json[]): PageFacts {
  const facts: PageFacts = { title: null, address: null, rentCents: null, beds: null, baths: null };
  for (const item of items) {
    const type = [item["@type"]].flat().join(" ");
    if (!PLACE_TYPES.test(type)) continue;
    facts.title ??= textOf(item.name);
    facts.address ??= addressOf(item.address) ?? addressOf((item.itemOffered as Json | undefined)?.address);
    const rooms = item.numberOfBedrooms ?? item.numberOfRooms;
    facts.beds ??= num(typeof rooms === "object" && rooms ? (rooms as Json).value : rooms);
    facts.baths ??= num(item.numberOfBathroomsTotal ?? item.numberOfFullBathrooms);
    const offers = [item.offers].flat().filter(Boolean) as Json[];
    for (const offer of offers) {
      const price = num(offer.price ?? (offer.priceSpecification as Json | undefined)?.price);
      // Rent, not a sale price: ignore anything above $50k a month.
      if (price && price >= 100 && price <= 50_000) facts.rentCents ??= Math.round(price * 100);
    }
  }
  return facts;
}

/** The page's readable text: no scripts, styles, navigation chrome or tags. */
function visibleText(html: string): string {
  const body = /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html;
  return decode(
    body
      .replace(/<(script|style|noscript|svg|template|iframe|nav|footer|header)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  );
}

export function readPage(html: string, base?: string): ReadPage {
  const items = jsonLd(html);
  const ld = factsFromJsonLd(items);
  const ogTitle = meta(html, "og:title");
  const docTitle = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const description = meta(html, "og:description") ?? meta(html, "description");
  const title = ld.title ?? ogTitle ?? (docTitle ? decode(docTitle) : null);
  const facts: PageFacts = { ...ld, title: title ? title.slice(0, 120) : null };

  const body = visibleText(html);
  const text = [title, ld.address, description, body].filter(Boolean).join("\n").slice(0, MAX_PASTE_CHARS);
  // A real listing page is long; a short page with bot-check signs is a block page.
  const challenge = body.length < 3000 && (WALL_MARKUP.test(html) || WALL_WORDS.test(`${docTitle ?? ""} ${body}`));
  // Photo candidates: the share image, the structured data's images, then large-looking <img>s in page order.
  const imgs = [...html.matchAll(/<img\b[^>]*?\s(?:data-src|src)\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]!);
  const backgrounds = [...html.matchAll(/background(?:-image)?\s*:\s*url\(\s*["']?([^"')]+)/gi)].map((m) => m[1]!);
  const images = listingPhotos(
    [meta(html, "og:image:secure_url"), meta(html, "og:image"), ...items.flatMap((i) => imagesOf(i.image)), ...imgs, ...backgrounds].filter((x): x is string => Boolean(x)),
    base
  );
  return { facts, text, challenge, images };
}

/** Lines that usually carry listing facts: money, rooms, dates, an address. */
const FACT_LINE =
  /\$\s?\d|\b(?:bed|bd|bath|ba|studio|lease|available|move[- ]in|deposit|parking|garage|laundry|washer|sq\.?\s?ft|utilities|rent)\b|\b\d{3,5}\s+[a-z][a-z .]*\b(?:rd|road|dr|drive|st|street|ave|avenue|ln|lane|way|blvd|ct|pl)\b/i;

/**
 * A page someone sent from their own browser (Send to Corral) is already
 * rendered text, often with menus and footers around the listing. Keep the
 * lines that carry facts (and their neighbors) first, then fill the rest of
 * the budget in page order, so the listing survives the length cap.
 */
export function focusListingText(title: string, text: string, max = MAX_PASTE_CHARS): string {
  const seen = new Set<string>();
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l && !seen.has(l) && (seen.add(l), true));
  const keep = new Set<number>();
  lines.forEach((l, i) => {
    if (FACT_LINE.test(l)) for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 2); j++) keep.add(j);
  });
  const out: string[] = [];
  let size = title.length + 1;
  const take = (i: number) => {
    const l = lines[i]!;
    if (size + l.length + 1 > max) return false;
    out[i] = l;
    size += l.length + 1;
    return true;
  };
  // A line too long for what's left is skipped, not the end: shorter fact
  // lines after it can still fit.
  for (const i of [...keep].sort((a, b) => a - b)) take(i);
  for (let i = 0; i < lines.length; i++) if (out[i] === undefined) take(i);
  return [title, ...out.filter((l) => l !== undefined)].filter(Boolean).join("\n").slice(0, max);
}

/** Read a page sent from the browser: its rendered text plus any structured data it carries. */
export function readSentPage(sent: { url: string; title: string; text: string; ld: string[]; images?: string[] }): { facts: PageFacts; text: string; images: string[] } {
  const items: Json[] = [];
  for (const raw of sent.ld) {
    try {
      const walk = (v: unknown) => {
        if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === "object") {
          items.push(v as Json);
          const graph = (v as Json)["@graph"];
          if (graph) walk(graph);
        }
      };
      walk(JSON.parse(raw));
    } catch {
      // Broken structured data: the text still gets read.
    }
  }
  const ld = factsFromJsonLd(items);
  const title = decode(sent.title).slice(0, 120);
  const images = listingPhotos([...items.flatMap((i) => imagesOf(i.image)), ...(sent.images ?? [])], sent.url);
  return { facts: { ...ld, title: ld.title ?? (title || null) }, text: focusListingText(title, sent.text), images };
}

