import { z } from "zod";
import { LAUNDRY_OPTIONS, PARKING_OPTIONS } from "@/lib/listing";

/**
 * Autofill: turn pasted listing text into form fields for the person to review.
 *
 * This file is the deterministic parser. It always works, costs nothing, and is
 * what runs when there's no AI key or the AI call fails. It only reads text the
 * person pasted; it never fetches a URL.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** What autofill can return. Null means "not found": the form leaves that field alone. */
export const parsedListingSchema = z.object({
  title: z.string().trim().min(1).max(120).nullable(),
  address: z.string().trim().min(1).max(200).nullable(),
  url: z
    .string()
    .trim()
    .max(2000)
    .regex(/^https?:\/\//i)
    .nullable(),
  rentCents: z.number().int().min(10000).max(5_000_000).nullable(),
  beds: z.number().min(0).max(20).nullable(),
  baths: z.number().min(0).max(20).nullable(),
  leaseStart: isoDate.nullable(),
  leaseEnd: isoDate.nullable(),
  parking: z.enum(PARKING_OPTIONS).nullable(),
  laundry: z.enum(LAUNDRY_OPTIONS).nullable()
});
export type ParsedListing = z.infer<typeof parsedListingSchema>;

export const EMPTY_PARSE: ParsedListing = {
  title: null,
  address: null,
  url: null,
  rentCents: null,
  beds: null,
  baths: null,
  leaseStart: null,
  leaseEnd: null,
  parking: null,
  laundry: null
};

export const MAX_PASTE_CHARS = 8000;

// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12
};

/** Streets people write without a suffix ("6680 Del Playa"). */
const KNOWN_STREETS = [
  "Del Playa", "Sabado Tarde", "Trigo", "Pardall", "El Colegio", "Embarcadero del Norte", "Embarcadero del Mar",
  "Camino Pescadero", "Camino del Sur", "Camino Corto", "Camino Lindo", "Picasso", "Abrego", "Sueno", "Cervantes",
  "El Greco", "Segovia", "Cordoba", "Madrid", "Seville", "El Nido", "Fortuna", "Pasado", "Estero", "Ocean",
  "Calle Real", "Hollister"
];

// The lookahead stops "Pl" from matching inside "Playa".
const SUFFIX = "(?:Rd|Road|Dr|Drive|St|Street|Ave|Avenue|Way|Ln|Lane|Blvd|Boulevard|Ct|Court|Pl|Place|Cir|Circle|Ter|Terrace)(?![A-Za-z])\\.?";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function iso(y: number, m: number, d: number): string | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** A month/day with no year means the next time that date comes around. */
function withYear(m: number, d: number, year: number | null, now: Date): string | null {
  if (year !== null) return iso(year < 100 ? 2000 + year : year, m, d);
  const thisYear = now.getFullYear();
  const candidate = iso(thisYear, m, d);
  if (!candidate) return null;
  const today = iso(thisYear, now.getMonth() + 1, now.getDate())!;
  return candidate >= today ? candidate : iso(thisYear + 1, m, d);
}

type FoundDate = { iso: string; index: number; end: number };

/** Every date in the text: "Sept 1", "September 1st, 2027", "9/1", "9/1/27", "2027-09-01". */
function findDates(text: string, now: Date): FoundDate[] {
  const out: FoundDate[] = [];
  const named = /\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/gi;
  for (const m of text.matchAll(named)) {
    const value = withYear(MONTHS[m[1].toLowerCase()], Number(m[2]), m[3] ? Number(m[3]) : null, now);
    if (value) out.push({ iso: value, index: m.index!, end: m.index! + m[0].length });
  }
  const numeric = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b/g;
  for (const m of text.matchAll(numeric)) {
    // Skip things like "4/2" right after "bd" or "br/ba" counts.
    if (/\b\d\s*\/\s*\d\b/.test(m[0]) && Number(m[1]) <= 6 && Number(m[2]) <= 4 && !m[3]) continue;
    const value = withYear(Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : null, now);
    if (value) out.push({ iso: value, index: m.index!, end: m.index! + m[0].length });
  }
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    const value = iso(Number(m[1]), Number(m[2]), Number(m[3]));
    if (value) out.push({ iso: value, index: m.index!, end: m.index! + m[0].length });
  }
  return out.sort((a, b) => a.index - b.index);
}

function addMonthsMinusDay(start: string, months: number): string {
  const [y, m, d] = start.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function parseLease(text: string, now: Date): Pick<ParsedListing, "leaseStart" | "leaseEnd"> {
  const dates = findDates(text, now);
  // A range: "Sept 1 - Aug 31", "9/1 to 8/31", "Sep 1 through Jun 30".
  for (let i = 0; i < dates.length - 1; i++) {
    const between = text.slice(dates[i].end, dates[i + 1].index);
    if (/^\s*(?:-|–|—|to|thru|through|until|till)\s*$/i.test(between) && dates[i + 1].iso > dates[i].iso) {
      return { leaseStart: dates[i].iso, leaseEnd: dates[i + 1].iso };
    }
  }
  // A start date near "available / starting / move-in / lease begins".
  const start = dates.find((d) =>
    /(avail|start|begin|move[- ]?in|from|lease\s+(?:start|begin)s?)[^.\n]{0,25}$/i.test(text.slice(Math.max(0, d.index - 40), d.index))
  );
  if (!start) return { leaseStart: null, leaseEnd: null };
  const term = text.match(/\b(\d{1,2}|one|twelve|ten|nine|eleven)[- ]?(month|mo|year|yr)s?\b(?:[- ]lease)?/i);
  let end: string | null = null;
  if (term) {
    const words: Record<string, number> = { one: 1, nine: 9, ten: 10, eleven: 11, twelve: 12 };
    const n = words[term[1].toLowerCase()] ?? Number(term[1]);
    const months = /^y/i.test(term[2]) ? n * 12 : n;
    if (months >= 1 && months <= 24) end = addMonthsMinusDay(start.iso, months);
  }
  return { leaseStart: start.iso, leaseEnd: end };
}

function parseRent(text: string): number | null {
  const money = /\$\s?(\d{1,2},\d{3}|\d{3,5})(?:\.(\d{2}))?(?!\d)/g;
  let best: { cents: number; score: number } | null = null;
  for (const m of text.matchAll(money)) {
    const cents = Number(m[1].replace(",", "")) * 100 + (m[2] ? Number(m[2]) : 0);
    if (cents < 30000 || cents > 5_000_000) continue;
    const before = text.slice(Math.max(0, m.index! - 30), m.index!).toLowerCase();
    const after = text.slice(m.index! + m[0].length, m.index! + m[0].length + 20).toLowerCase();
    if (/deposit|fee|utilit|per person|\/\s*person|each|pp\b|application/.test(before + " " + after.slice(0, 14))) continue;
    let score = 1;
    if (/rent|price|lease|total/.test(before)) score += 2;
    if (/^\s*(?:\/\s*mo|per\s+mo|a\s+month|monthly|\/\s*month)/.test(after)) score += 2;
    if (!best || score > best.score) best = { cents, score };
  }
  return best?.cents ?? null;
}

function parseCounts(text: string): Pick<ParsedListing, "beds" | "baths"> {
  const num = (s: string) => Number(s);
  let beds: number | null = null;
  let baths: number | null = null;
  const combo = text.match(/\b(\d{1,2})\s*(?:bd|br|bed(?:room)?s?)\s*[/,|&]?\s*(\d(?:\.\d)?)\s*(?:ba|bath(?:room)?s?)\b/i);
  if (combo) {
    beds = num(combo[1]);
    baths = num(combo[2]);
  }
  beds ??= (() => {
    const m = text.match(/\b(\d{1,2})[\s-]*(?:bd|bds|br|bdrm|bed(?:room)?s?)\b/i);
    if (m) return num(m[1]);
    return /\bstudio\b/i.test(text) ? 0 : null;
  })();
  baths ??= (() => {
    const m = text.match(/\b(\d(?:\.\d)?)[\s-]*(?:ba|bth|bath(?:room)?s?)\b/i);
    return m ? num(m[1]) : null;
  })();
  return { beds, baths };
}

function parseAddress(text: string): string | null {
  const city = /\b(Isla Vista|Goleta|Santa Barbara)\b/i.exec(text)?.[1];
  const withCity = (street: string) => (city ? `${street}, ${titleCase(city)}` : street);

  const suffixed = new RegExp(`\\b(\\d{3,5}(?:\\s*[A-Z])?\\s+(?:[A-Z][a-z]+\\s+){1,3}${SUFFIX})`, "g");
  const m = suffixed.exec(text);
  if (m) return withCity(m[1].replace(/\s+/g, " ").trim());

  for (const street of KNOWN_STREETS) {
    const known = new RegExp(`\\b(\\d{3,5})\\s+${street.replace(/ /g, "\\s+")}\\b`, "i");
    const k = known.exec(text);
    if (k) return withCity(`${k[1]} ${street}`);
  }
  return null;
}

function titleCase(s: string) {
  return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

function parseParking(text: string): ParsedListing["parking"] {
  if (/\bno\s+(?:off[- ]street\s+)?parking\b|parking\s*:\s*none/i.test(text)) return "none";
  if (/\bgarage\b/i.test(text)) return "garage";
  if (/\b(driveway|off[- ]street|parking\s+(?:spot|space)s?|carport|parking\s+lot|assigned\s+parking)\b/i.test(text)) return "driveway";
  if (/\bstreet\s+parking\b/i.test(text)) return "street";
  return null;
}

function parseLaundry(text: string): ParsedListing["laundry"] {
  if (/\bno\s+(?:on[- ]site\s+)?laundry\b|laundry\s*:\s*none/i.test(text)) return "none";
  if (/\b(in[- ]unit|w\/d\s+in|washer\s*(?:\/|and|&)\s*dryer\s+(?:in|included)|in[- ]suite)\b/i.test(text)) return "in_unit";
  if (/\b(laundry\s+(?:on[- ]site|room|facilities)|on[- ]site\s+laundry|shared\s+laundry|coin[- ]op|coin\s+laundry)\b/i.test(text)) return "on_site";
  return null;
}

function parseTitle(text: string): string | null {
  const first = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length >= 4);
  if (!first) return null;
  let cleaned = first
    .replace(/\$\s?[\d,]+(?:\.\d{2})?\s*(?:\/\s*mo(?:nth)?|per\s+month|a\s+month)?/gi, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s*([,;])\s*(?:[,;]\s*)+/g, "$1 ") // ", ," left behind by a removed price
    .replace(/\s*[-–—|•:]\s*(?=[.,;!?]|$)/g, "") // a separator left dangling before punctuation
    .replace(/\s{2,}/g, " ")
    .trim();
  // A one-line paste is the whole listing: keep its first sentence, then its first phrase.
  cleaned = cleaned.split(/(?<=[a-z0-9)])\s*[.!?](?:\s|$)/i)[0];
  if (cleaned.length > 60) cleaned = cleaned.split(/[,;]/)[0];
  cleaned = cleaned.replace(/^[\s\-–—|•:,;]+|[\s\-–—|•:,;]+$/g, "").trim();
  if (cleaned.length < 4 || cleaned.length > 120) return null;
  return cleaned;
}

/** The deterministic parser: fills what it can, leaves the rest null. */
export function parseListingText(input: string, now: Date = new Date()): ParsedListing {
  const text = input.slice(0, MAX_PASTE_CHARS);
  const url = text.match(/https?:\/\/[^\s<>"')\]]+/i)?.[0]?.replace(/[.,;]+$/, "") ?? null;
  const result: ParsedListing = {
    title: parseTitle(text),
    address: parseAddress(text),
    url,
    rentCents: parseRent(text),
    ...parseCounts(text),
    ...parseLease(text, now),
    parking: parseParking(text),
    laundry: parseLaundry(text)
  };
  // Anything that fails the schema becomes "not found" rather than a bad value.
  const checked = parsedListingSchema.safeParse(result);
  if (checked.success) return checked.data;
  const clean = { ...result };
  for (const issue of checked.error.issues) {
    const key = issue.path[0] as keyof ParsedListing;
    (clean as Record<string, unknown>)[key] = null;
  }
  return clean;
}

/** How many fields a parse filled, for the "Filled 6 fields" message. */
export function countFilled(p: ParsedListing): number {
  return Object.values(p).filter((v) => v !== null).length;
}
