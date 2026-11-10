/**
 * Street-first naming: students refer to places by street and number
 * ("Sabado Tarde, 6512"), so rows lead with that. Works for any address with
 * a street; falls back to the place's own title when there isn't one.
 */

const SUFFIXES = new Set([
  "rd", "road", "dr", "drive", "ave", "avenue", "st", "street", "blvd", "boulevard",
  "ln", "lane", "way", "ct", "court", "pl", "place", "cir", "circle", "ter", "terrace",
  "pkwy", "parkway", "hwy", "highway"
]);

/** Short suffix spelling used when a suffix is kept ("Trigo Rd"). */
const SHORT: Record<string, string> = {
  road: "Rd", drive: "Dr", avenue: "Ave", street: "St", boulevard: "Blvd", lane: "Ln",
  court: "Ct", place: "Pl", circle: "Cir", terrace: "Ter", parkway: "Pkwy", highway: "Hwy"
};

export type StreetLabel = {
  /** Street name, e.g. "Sabado Tarde" or "Trigo Rd". Null when unknown. */
  street: string | null;
  /** House number, e.g. "6512". Null when unknown. */
  number: string | null;
};

export function parseStreet(address: string | null): StreetLabel {
  if (!address) return { street: null, number: null };
  // Only the first comma-separated part is the street line.
  const line = address.split(",")[0].replace(/\(.*?\)/g, "").trim();
  if (!line) return { street: null, number: null };

  const match = line.match(/^(\d+[A-Za-z]?(?:-\d+)?)\s+(.+)$/);
  const number = match ? match[1] : null;
  let words = (match ? match[2] : line).split(/\s+/).filter(Boolean);

  // Drop trailing unit markers ("#B", "Apt 3", "Unit 2").
  const unitAt = words.findIndex((w) => /^(#|apt|unit|ste|suite)/i.test(w));
  if (unitAt > 0) words = words.slice(0, unitAt);

  // Drop the suffix from multi-word names ("Sabado Tarde Rd" → "Sabado Tarde"), but keep it,
  // shortened, on one-word names so they still read as streets ("Trigo Rd", not "Trigo").
  const last = words[words.length - 1]?.toLowerCase().replace(/\.$/, "") ?? "";
  if (words.length > 2 && SUFFIXES.has(last)) {
    words = words.slice(0, -1);
  } else if (words.length === 2 && SUFFIXES.has(last)) {
    words = [words[0], SHORT[last] ?? words[1].replace(/\.$/, "")];
  }
  const street = words.join(" ").trim();
  return { street: street || null, number };
}

/** The row headline: "Sabado Tarde, 6512", "Trigo Rd, 6545", "Calle Real", or the title. */
export function streetHeadline(address: string | null, title: string): string {
  const { street, number } = parseStreet(address);
  if (!street) return title;
  return number ? `${street}, ${number}` : street;
}

/** The area label shown beside a name ("IV", "Goleta"), from the address's city part. */
export function areaLabel(address: string | null): string | null {
  if (!address) return null;
  const rest = address.split(",").slice(1).join(",").toLowerCase();
  if (/isla vista|\biv\b/.test(rest)) return "IV";
  if (/goleta/.test(rest)) return "Goleta";
  if (/santa barbara/.test(rest)) return "SB";
  return null;
}
