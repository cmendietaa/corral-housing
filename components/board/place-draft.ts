import { centsToDollarsInput, parseDollars } from "@/lib/format";
import { listingInputSchema, type ListingInput } from "@/lib/listing";
import type { ParsedListing } from "@/lib/parse-listing";

/** What the add and edit forms hold while someone types: every field as text. */
export type Draft = {
  url: string;
  title: string;
  address: string;
  rent: string;
  beds: string;
  baths: string;
  leaseStart: string;
  leaseEnd: string;
  parking: string;
  laundry: string;
  notes: string;
};

export type DraftErrors = Partial<Record<keyof Draft, string>>;

export function toDraft(l: ListingInput): Draft {
  return {
    url: l.url ?? "",
    title: l.title,
    address: l.address ?? "",
    rent: centsToDollarsInput(l.rentCents),
    beds: l.beds === null ? "" : String(l.beds),
    baths: l.baths === null ? "" : String(l.baths),
    leaseStart: l.leaseStart ?? "",
    leaseEnd: l.leaseEnd ?? "",
    parking: l.parking ?? "",
    laundry: l.laundry ?? "",
    notes: l.notes ?? ""
  };
}

/** Autofill or link-import results as draft text; missing facts stay undefined. */
export function parsedToDraft(f: ParsedListing): Partial<Draft> {
  return {
    url: f.url ?? undefined,
    title: f.title ?? undefined,
    address: f.address ?? undefined,
    rent: f.rentCents === null ? undefined : centsToDollarsInput(f.rentCents),
    beds: f.beds === null ? undefined : String(f.beds),
    baths: f.baths === null ? undefined : String(f.baths),
    leaseStart: f.leaseStart ?? undefined,
    leaseEnd: f.leaseEnd ?? undefined,
    parking: f.parking ?? undefined,
    laundry: f.laundry ?? undefined
  };
}

/** Fill only the fields that are still empty. Returns the new draft and which fields changed. */
export function fillEmpty(draft: Draft, incoming: Partial<Draft>): { next: Draft; changed: Set<keyof Draft> } {
  const changed = new Set<keyof Draft>();
  const next = { ...draft };
  for (const [k, v] of Object.entries(incoming) as [keyof Draft, string | undefined][]) {
    // Never overwrite something the person already typed.
    if (v !== undefined && v !== "" && next[k].trim() === "") {
      next[k] = v;
      changed.add(k);
    }
  }
  return { next, changed };
}

function num(value: string): number | null {
  const v = value.trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : Number.NaN;
}

const blank = (s: string) => (s.trim() === "" ? null : s.trim());

/** Turn a draft into a listing, or say what's wrong with each field. */
export function validateDraft(draft: Draft, base: ListingInput): { input: ListingInput | null; errors: DraftErrors } {
  const rentCents = parseDollars(draft.rent);
  const beds = num(draft.beds);
  const baths = num(draft.baths);
  const errors: DraftErrors = {};
  if (Number.isNaN(rentCents)) errors.rent = "Enter a monthly amount like 5400";
  if (Number.isNaN(beds)) errors.beds = "Enter a number";
  if (Number.isNaN(baths)) errors.baths = "Enter a number";

  const candidate: ListingInput = {
    ...base,
    url: blank(draft.url),
    title: draft.title.trim(),
    address: blank(draft.address),
    rentCents: Number.isNaN(rentCents) ? null : rentCents,
    beds: Number.isNaN(beds) ? null : beds,
    baths: Number.isNaN(baths) ? null : baths,
    leaseStart: blank(draft.leaseStart),
    leaseEnd: blank(draft.leaseEnd),
    parking: (blank(draft.parking) as ListingInput["parking"]) ?? null,
    laundry: (blank(draft.laundry) as ListingInput["laundry"]) ?? null,
    notes: blank(draft.notes)
  };

  const parsed = listingInputSchema.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      const field = key === "rentCents" ? "rent" : (key as keyof Draft);
      if (field in draft && !errors[field]) errors[field] = issue.message;
    }
  }
  if (candidate.leaseStart && candidate.leaseEnd && candidate.leaseEnd < candidate.leaseStart) {
    errors.leaseEnd = "Lease end is before the start";
  }
  return { input: parsed.success && Object.keys(errors).length === 0 ? parsed.data : null, errors };
}

/** A single pasted link, alone: "https://…" or "www.…". */
export function asLink(text: string): string | null {
  const t = text.trim();
  if (!t || /\s/.test(t)) return null;
  if (/^https?:\/\/\S+\.\S+/i.test(t)) return t;
  if (/^www\.\S+\.\S+/i.test(t)) return `https://${t}`;
  return null;
}
