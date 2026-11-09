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

export type StreetLabel = {
  /** Street name without its suffix, e.g. "Sabado Tarde". Null when unknown. */
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

  // Drop trailing unit markers ("#B", "Apt 3", "Unit 2") and the street suffix.
  const unitAt = words.findIndex((w) => /^(#|apt|unit|ste|suite)/i.test(w));
  if (unitAt > 0) words = words.slice(0, unitAt);
  if (words.length > 1 && SUFFIXES.has(words[words.length - 1].toLowerCase().replace(/\.$/, ""))) {
    words = words.slice(0, -1);
  }
  const street = words.join(" ").trim();
  return { street: street || null, number };
}

/** The row headline: "Sabado Tarde, 6512", "Embarcadero del Norte", or the title. */
export function streetHeadline(address: string | null, title: string): string {
  const { street, number } = parseStreet(address);
  if (!street) return title;
  return number ? `${street}, ${number}` : street;
}

/** Group key for "group by street". Places without a street go under "No address yet". */
export function streetGroup(address: string | null): string {
  return parseStreet(address).street ?? "No address yet";
}
