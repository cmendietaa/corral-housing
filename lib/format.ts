import { UNKNOWN } from "@/lib/compare";

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const dueDate = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC"
});

/** Parse YYYY-MM-DD as a calendar date (no timezone shift). */
function calendar(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function formatLease(start: string | null, end: string | null): string {
  if (!start && !end) return UNKNOWN;
  const s = start ? shortDate.format(calendar(start)) : "?";
  const e = end ? shortDate.format(calendar(end)) : "?";
  return `${s} – ${e}`;
}

export function formatDue(iso: string): string {
  return dueDate.format(calendar(iso));
}

/** True when the due date is before today in the viewer's local calendar. */
export function isOverdue(iso: string, today: Date = new Date()): boolean {
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return calendar(iso).getTime() < t;
}

/** "4 beds", "1 bath", or "Beds unknown" when missing. */
export function formatCount(n: number | null, noun: string): string {
  if (n === null) return `${noun[0].toUpperCase()}${noun.slice(1)}s unknown`;
  const plural = n === 1 ? noun : `${noun}s`;
  return `${n} ${plural}`;
}

/** Lease phrase for card meta lines: "Lease Sep 1 – Jun 30" or "Lease dates unknown". */
export function formatLeasePhrase(start: string | null, end: string | null): string {
  return !start && !end ? "Lease dates unknown" : `Lease ${formatLease(start, end)}`;
}

/** "$5,400" or "5400" or "5,400.50" → cents. Empty → null. Invalid → NaN. */
export function parseDollars(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
  return Math.round(Number(cleaned) * 100);
}

export function centsToDollarsInput(cents: number | null): string {
  if (cents === null) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** Map-tag rent: "$5.4k", "$950", or "$?" when unknown. */
export function formatRentShort(cents: number | null): string {
  if (cents === null) return "$?";
  const dollars = Math.round(cents / 100);
  if (dollars < 1000) return `$${dollars}`;
  const k = Math.round(dollars / 100) / 10;
  return `$${Number.isInteger(k) ? k.toFixed(0) : k.toFixed(1)}k`;
}
